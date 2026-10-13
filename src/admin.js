import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const KIT_COST = 1700; // Fixed cost per player kit (PKR)

const mainContent = document.getElementById('main-content');
const logoutBtn = document.getElementById('logout-btn');
const playersTbody = document.getElementById('players-tbody');
const searchInput = document.getElementById('search-input');
const exportBtn = document.getElementById('export-btn');
const dashboardAlert = document.getElementById('dashboard-alert');

// Stats Elements
const statTotalPlayers = document.getElementById('stat-total-players');
const statTotalAmount = document.getElementById('stat-total-amount');
const statPaidAmount = document.getElementById('stat-paid-amount');
const statPaidBreakdown = document.getElementById('stat-paid-breakdown');
const statUnpaidAmount = document.getElementById('stat-unpaid-amount');
const statUnpaidCount = document.getElementById('stat-unpaid-count');
const countAll = document.getElementById('count-all');
const countPaid = document.getElementById('count-paid');
const countPartial = document.getElementById('count-partial');
const countUnpaid = document.getElementById('count-unpaid');

// Filter Tabs
const filterTabs = document.querySelectorAll('.filter-tab');

// Quick Payment Modal Elements
const paymentModal = document.getElementById('payment-modal');
const paymentForm = document.getElementById('payment-form');
const paymentPlayerInfo = document.getElementById('payment-player-info');
const quickPaymentPlayerId = document.getElementById('quick-payment-player-id');
const quickPaidAmountInput = document.getElementById('quick-paid-amount');
const quickPaymentHint = document.getElementById('quick-payment-hint');
const cancelPaymentBtn = document.getElementById('cancel-payment');
const cancelPaymentXBtn = document.getElementById('cancel-payment-x');
const savePaymentBtn = document.getElementById('save-payment');
const paymentAlert = document.getElementById('payment-alert');

// Add Player Modal Elements
const addModal = document.getElementById('add-modal');
const addForm = document.getElementById('add-form');
const addPlayerBtn = document.getElementById('add-player-btn');
const cancelAddBtn = document.getElementById('cancel-add');
const cancelAddXBtn = document.getElementById('cancel-add-x');
const saveAddBtn = document.getElementById('save-add');
const addAlert = document.getElementById('add-alert');
const addPaidAmountInput = document.getElementById('add-paid-amount');
const addPaymentHint = document.getElementById('add-payment-hint');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const cancelEditBtn = document.getElementById('cancel-edit');
const cancelEditXBtn = document.getElementById('cancel-edit-x');
const editAlert = document.getElementById('edit-alert');
const saveEditBtn = document.getElementById('save-edit');
const editPaidAmountInput = document.getElementById('edit-paid-amount');
const editPaymentHint = document.getElementById('edit-payment-hint');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

let players = [];
let deletePlayerId = null;
let currentFilter = 'all'; // 'all' | 'paid' | 'partial' | 'unpaid'
let currentSearch = '';

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = '/admin-login/';
  } else {
    mainContent.style.display = 'block';
    loadPlayers();
  }
});

logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

// Helper to determine payment info for any player
function getPaymentInfo(player) {
  let amount = 0;
  if (typeof player.paidAmount === 'number') {
    amount = Math.max(0, player.paidAmount);
  } else if (player.isPaid === true) {
    amount = KIT_COST;
  } else {
    amount = 0;
  }

  const remaining = Math.max(0, KIT_COST - amount);
  let status = 'unpaid';
  if (amount >= KIT_COST) {
    status = 'paid';
  } else if (amount > 0) {
    status = 'partial';
  }

  return { amount, remaining, status };
}

function updatePaymentHint(inputEl, hintEl) {
  if (!inputEl || !hintEl) return;
  const val = Number(inputEl.value) || 0;
  const rem = Math.max(0, KIT_COST - val);
  if (val >= KIT_COST) {
    hintEl.innerHTML = `Payment Status: <strong style="color:#065f46;">Full Paid (Rs. ${val.toLocaleString()})</strong> • Due: <strong>Rs. 0</strong>`;
  } else if (val > 0) {
    hintEl.innerHTML = `Payment Status: <strong style="color:#3730a3;">Partial Paid (Rs. ${val.toLocaleString()})</strong> • Remaining Due: <strong style="color:#b91c1c;">Rs. ${rem.toLocaleString()}</strong>`;
  } else {
    hintEl.innerHTML = `Payment Status: <strong style="color:#991b1b;">Unpaid</strong> • Remaining Due: <strong>Rs. ${KIT_COST.toLocaleString()}</strong>`;
  }
}

// Preset button handlers
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const val = Number(btn.dataset.val);

    if (target === 'quick' && quickPaidAmountInput) {
      quickPaidAmountInput.value = val;
      updatePaymentHint(quickPaidAmountInput, quickPaymentHint);
    } else if (target === 'add' && addPaidAmountInput) {
      addPaidAmountInput.value = val;
      updatePaymentHint(addPaidAmountInput, addPaymentHint);
    } else if (target === 'edit' && editPaidAmountInput) {
      editPaidAmountInput.value = val;
      updatePaymentHint(editPaidAmountInput, editPaymentHint);
    }
  });
});

if (quickPaidAmountInput) {
  quickPaidAmountInput.addEventListener('input', () => updatePaymentHint(quickPaidAmountInput, quickPaymentHint));
}
if (addPaidAmountInput) {
  addPaidAmountInput.addEventListener('input', () => updatePaymentHint(addPaidAmountInput, addPaymentHint));
}
if (editPaidAmountInput) {
  editPaidAmountInput.addEventListener('input', () => updatePaymentHint(editPaidAmountInput, editPaymentHint));
}

function loadPlayers() {
  const q = query(collection(db, 'players'));
  onSnapshot(q, (snapshot) => {
    players = [];
    snapshot.forEach((docSnap) => {
      players.push({ id: docSnap.id, ...docSnap.data() });
    });

    players.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    updateStats();
    renderTable(getFilteredPlayers());
  }, (err) => {
    console.error("Firestore onSnapshot error:", err);
    showAlert("Failed to load players: " + err.message, "error");
  });
}

function updateStats() {
  const total = players.length;
  let totalCollected = 0;
  let totalPending = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;

  players.forEach(p => {
    const { amount, remaining, status } = getPaymentInfo(p);
    totalCollected += amount;
    totalPending += remaining;

    if (status === 'paid') paidCount++;
    else if (status === 'partial') partialCount++;
    else unpaidCount++;
  });

  const totalOrderValue = total * KIT_COST;

  if (statTotalPlayers) statTotalPlayers.textContent = total;
  if (statTotalAmount) statTotalAmount.textContent = `Total Value: Rs. ${totalOrderValue.toLocaleString()}`;
  if (statPaidAmount) statPaidAmount.textContent = `Rs. ${totalCollected.toLocaleString()}`;
  if (statPaidBreakdown) statPaidBreakdown.textContent = `${paidCount} Full • ${partialCount} Partial`;
  if (statUnpaidAmount) statUnpaidAmount.textContent = `Rs. ${totalPending.toLocaleString()}`;
  if (statUnpaidCount) statUnpaidCount.textContent = `${unpaidCount} Unpaid players`;

  if (countAll) countAll.textContent = total;
  if (countPaid) countPaid.textContent = paidCount;
  if (countPartial) countPartial.textContent = partialCount;
  if (countUnpaid) countUnpaid.textContent = unpaidCount;
}

function getFilteredPlayers() {
  return players.filter(p => {
    const { status, amount } = getPaymentInfo(p);

    if (currentFilter === 'paid' && status !== 'paid') return false;
    if (currentFilter === 'partial' && status !== 'partial') return false;
    if (currentFilter === 'unpaid' && status !== 'unpaid') return false;

    if (currentSearch) {
      const term = currentSearch.toLowerCase();
      const nameMatch = (p.name || '').toLowerCase().includes(term);
      const kitMatch = String(p.kitNumber || '').includes(term);
      const sizeMatch = (p.kitSize || '').toLowerCase().includes(term);
      const statusMatch = status.includes(term);
      const amountMatch = String(amount).includes(term);
      return nameMatch || kitMatch || sizeMatch || statusMatch || amountMatch;
    }
    return true;
  });
}

function renderTable(data) {
  playersTbody.innerHTML = '';

  if (data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" style="text-align: center; color: #6b7280; padding: 24px;">No players found matching your criteria.</td>`;
    playersTbody.appendChild(tr);
    return;
  }

  data.forEach(player => {
    const tr = document.createElement('tr');
    const { amount, remaining, status } = getPaymentInfo(player);
    
    let dateStr = 'N/A';
    if (player.createdAt) {
      dateStr = new Date(player.createdAt.toMillis ? player.createdAt.toMillis() : player.createdAt).toLocaleString();
    }

    let badgeHtml = '';
    if (status === 'paid') {
      badgeHtml = `<span class="badge badge-paid">✓ Paid (Rs. ${amount.toLocaleString()})</span>`;
    } else if (status === 'partial') {
      badgeHtml = `
        <span class="badge badge-partial">⚡ Partial (Rs. ${amount.toLocaleString()})</span>
        <span class="remaining-text">Due: Rs. ${remaining.toLocaleString()}</span>
      `;
    } else {
      badgeHtml = `
        <span class="badge badge-unpaid">⏳ Unpaid</span>
        <span class="remaining-text">Due: Rs. ${KIT_COST.toLocaleString()}</span>
      `;
    }

    tr.innerHTML = `
      <td><strong>${escapeHTML(player.name)}</strong></td>
      <td><span style="font-weight:700; color: #047857; font-size: 1.05rem;">#${escapeHTML(String(player.kitNumber))}</span></td>
      <td>${escapeHTML(player.chestSize)}</td>
      <td>${escapeHTML(player.lengthSize)}</td>
      <td><span style="background:#f3f4f6; padding: 2px 8px; border-radius: 4px; font-weight:600;">${escapeHTML(player.kitSize)}</span></td>
      <td>
        <div class="payment-cell-badge">
          ${badgeHtml}
        </div>
      </td>
      <td style="font-size: 0.85rem; color: #4b5563;">${escapeHTML(dateStr)}</td>
      <td class="actions">
        <button class="btn-pay open-payment-modal-btn" data-id="${player.id}" title="Update payment for this player">Pay</button>
        <button class="btn-secondary edit-btn" data-id="${player.id}">Edit</button>
        <button class="btn-danger delete-btn" data-id="${player.id}">Delete</button>
      </td>
    `;
    playersTbody.appendChild(tr);
  });

  // Open Quick Payment Modal via Pay button in Actions
  document.querySelectorAll('.open-payment-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      openQuickPaymentModal(id);
    });
  });

  // Edit button listeners
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => openEditModal(e.target.dataset.id));
  });

  // Delete button listeners
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => openDeleteModal(e.target.dataset.id));
  });
}

async function setPlayerPayment(playerId, amount) {
  try {
    const docRef = doc(db, 'players', playerId);
    const validAmount = Math.max(0, Number(amount) || 0);
    const isPaid = validAmount >= KIT_COST;

    await updateDoc(docRef, {
      paidAmount: validAmount,
      isPaid: isPaid
    });

    const targetPlayer = players.find(p => p.id === playerId);
    const name = targetPlayer ? targetPlayer.name : 'Player';

    if (isPaid) {
      showAlert(`${name} marked as FULL PAID (Rs. ${validAmount.toLocaleString()})`, 'success');
    } else if (validAmount > 0) {
      showAlert(`${name} marked as PARTIAL PAID (Rs. ${validAmount.toLocaleString()})`, 'success');
    } else {
      showAlert(`${name} marked as UNPAID`, 'success');
    }
  } catch (error) {
    console.error("Failed to update payment status:", error);
    showAlert("Failed to update payment: " + error.message, "error");
    renderTable(getFilteredPlayers());
  }
}

// Quick Payment Modal
function openQuickPaymentModal(id) {
  const player = players.find(p => p.id === id);
  if (!player) return;

  const { amount } = getPaymentInfo(player);

  quickPaymentPlayerId.value = player.id;
  paymentPlayerInfo.textContent = `Player: ${player.name} (Kit #${player.kitNumber}) • Fixed Kit Cost: Rs. ${KIT_COST.toLocaleString()}`;
  quickPaidAmountInput.value = amount;
  updatePaymentHint(quickPaidAmountInput, quickPaymentHint);

  paymentAlert.style.display = 'none';
  paymentModal.classList.add('active');
}

const closePaymentModal = () => paymentModal.classList.remove('active');
if (cancelPaymentBtn) cancelPaymentBtn.addEventListener('click', closePaymentModal);
if (cancelPaymentXBtn) cancelPaymentXBtn.addEventListener('click', closePaymentModal);

paymentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  savePaymentBtn.disabled = true;
  paymentAlert.style.display = 'none';

  const playerId = quickPaymentPlayerId.value;
  const newAmount = Number(quickPaidAmountInput.value) || 0;

  try {
    await setPlayerPayment(playerId, newAmount);
    closePaymentModal();
  } catch (err) {
    paymentAlert.textContent = 'Failed to save payment: ' + err.message;
    paymentAlert.style.display = 'block';
  } finally {
    savePaymentBtn.disabled = false;
  }
});

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Search handling
searchInput.addEventListener('input', (e) => {
  currentSearch = e.target.value.trim();
  renderTable(getFilteredPlayers());
});

// Filter Tabs handling
filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderTable(getFilteredPlayers());
  });
});

// CSV Export
exportBtn.addEventListener('click', () => {
  if (players.length === 0) {
    showAlert('No players to export.', 'error');
    return;
  }
  
  const headers = [
    'Player Name',
    'Kit Number',
    'Chest Size',
    'Length Size',
    'Kit Size',
    'Payment Status',
    'Amount Paid (PKR)',
    'Remaining Due (PKR)',
    'Registration Date'
  ];
  const csvRows = [];
  csvRows.push(headers.join(','));

  players.forEach(p => {
    const { amount, remaining, status } = getPaymentInfo(p);
    const dateStr = p.createdAt ? new Date(p.createdAt.toMillis ? p.createdAt.toMillis() : p.createdAt).toLocaleString().replace(/,/g, '') : 'N/A';
    
    let statusLabel = 'UNPAID';
    if (status === 'paid') statusLabel = 'FULL PAID';
    else if (status === 'partial') statusLabel = 'PARTIAL PAID';

    const values = [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.kitNumber,
      `"${(p.chestSize || '').replace(/"/g, '""')}"`,
      `"${(p.lengthSize || '').replace(/"/g, '""')}"`,
      `"${p.kitSize || ''}"`,
      statusLabel,
      amount,
      remaining,
      `"${dateStr}"`
    ];
    csvRows.push(values.join(','));
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', 'football-players-kit-payments.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  showAlert('Player data with partial/full payments exported to CSV!', 'success');
});

// Add Player Modal Handling
if (addPlayerBtn && addModal) {
  addPlayerBtn.addEventListener('click', () => {
    addAlert.style.display = 'none';
    addForm.reset();
    if (addPaidAmountInput) {
      addPaidAmountInput.value = 0;
      updatePaymentHint(addPaidAmountInput, addPaymentHint);
    }
    addModal.classList.add('active');
  });

  const closeAddModal = () => addModal.classList.remove('active');
  if (cancelAddBtn) cancelAddBtn.addEventListener('click', closeAddModal);
  if (cancelAddXBtn) cancelAddXBtn.addEventListener('click', closeAddModal);

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveAddBtn.disabled = true;
    addAlert.style.display = 'none';

    const addKit = String(document.getElementById('add-kit').value);
    const addName = document.getElementById('add-name').value.trim();
    const addChest = document.getElementById('add-chest').value.trim();
    const addLength = document.getElementById('add-length').value.trim();
    const addKitSize = document.getElementById('add-kit-size').value;
    const addPaidAmount = Number(addPaidAmountInput.value) || 0;

    try {
      const primaryDocRef = doc(db, 'players', addKit);
      const primaryDocSnap = await getDoc(primaryDocRef);

      let targetDocRef = primaryDocRef;
      let isOverride = false;

      // Admin override: if kit taken, create unique doc ID so we don't overwrite existing player
      if (primaryDocSnap.exists()) {
        targetDocRef = doc(db, 'players', `${addKit}_admin_${Date.now()}`);
        isOverride = true;
      }

      await setDoc(targetDocRef, {
        name: addName,
        kitNumber: Number(addKit),
        chestSize: addChest,
        lengthSize: addLength,
        kitSize: addKitSize,
        paidAmount: addPaidAmount,
        isPaid: addPaidAmount >= KIT_COST,
        createdAt: serverTimestamp()
      });

      closeAddModal();
      if (isOverride) {
        showAlert(`Player ${addName} added with Kit #${addKit} (Admin override: number shared with another player)`, 'success');
      } else {
        showAlert(`Player ${addName} added successfully with Kit #${addKit}!`, 'success');
      }
    } catch (error) {
      console.error("Failed to add player:", error);
      addAlert.textContent = 'Failed to add player: ' + (error.message || 'Please try again.');
      addAlert.style.display = 'block';
    } finally {
      saveAddBtn.disabled = false;
    }
  });
}

// Edit Modal Handling
function openEditModal(id) {
  const player = players.find(p => p.id === id);
  if (!player) return;

  const { amount } = getPaymentInfo(player);

  document.getElementById('edit-player-id').value = player.id;
  document.getElementById('edit-original-kit').value = player.kitNumber;
  document.getElementById('edit-name').value = player.name || '';
  document.getElementById('edit-kit').value = player.kitNumber;
  document.getElementById('edit-chest').value = player.chestSize || '';
  document.getElementById('edit-length').value = player.lengthSize || '';
  document.getElementById('edit-kit-size').value = player.kitSize || 'M';

  if (editPaidAmountInput) {
    editPaidAmountInput.value = amount;
    updatePaymentHint(editPaidAmountInput, editPaymentHint);
  }
  
  editAlert.style.display = 'none';
  editModal.classList.add('active');
}

const closeEditModal = () => editModal.classList.remove('active');
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
if (cancelEditXBtn) cancelEditXBtn.addEventListener('click', closeEditModal);

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveEditBtn.disabled = true;
  editAlert.style.display = 'none';

  const playerId = document.getElementById('edit-player-id').value;
  const originalKit = String(document.getElementById('edit-original-kit').value);
  const newKit = String(document.getElementById('edit-kit').value);
  const newName = document.getElementById('edit-name').value.trim();
  const newChest = document.getElementById('edit-chest').value.trim();
  const newLength = document.getElementById('edit-length').value.trim();
  const newKitSize = document.getElementById('edit-kit-size').value;
  const newPaidAmount = Number(editPaidAmountInput.value) || 0;

  const oldPlayer = players.find(p => p.id === playerId);
  if (!oldPlayer) {
    saveEditBtn.disabled = false;
    return;
  }

  try {
    if (originalKit !== newKit) {
      // Admin can assign ANY number, even if already taken!
      const primaryDocRef = doc(db, 'players', newKit);
      const primaryDocSnap = await getDoc(primaryDocRef);

      let targetDocRef;
      let isOverride = false;

      if (primaryDocSnap.exists() && primaryDocRef.id !== playerId) {
        targetDocRef = doc(db, 'players', `${newKit}_admin_${Date.now()}`);
        isOverride = true;
      } else {
        targetDocRef = primaryDocRef;
      }

      const updatedData = {
        name: newName,
        kitNumber: Number(newKit),
        chestSize: newChest,
        lengthSize: newLength,
        kitSize: newKitSize,
        paidAmount: newPaidAmount,
        isPaid: newPaidAmount >= KIT_COST,
        createdAt: oldPlayer.createdAt || serverTimestamp()
      };

      await setDoc(targetDocRef, updatedData);

      // If document ID changed, delete old document
      if (targetDocRef.id !== playerId) {
        await deleteDoc(doc(db, 'players', playerId));
      }

      closeEditModal();
      if (isOverride) {
        showAlert(`Player updated with Kit #${newKit} (Admin override: number shared with another player)`, 'success');
      } else {
        showAlert(`Player updated successfully with Kit #${newKit}`, 'success');
      }
    } else {
      // Kit number did not change, update existing document
      const docRef = doc(db, 'players', playerId);
      await updateDoc(docRef, {
        name: newName,
        kitNumber: Number(newKit),
        chestSize: newChest,
        lengthSize: newLength,
        kitSize: newKitSize,
        paidAmount: newPaidAmount,
        isPaid: newPaidAmount >= KIT_COST
      });

      closeEditModal();
      showAlert('Player updated successfully', 'success');
    }
  } catch (error) {
    console.error("Failed to update player:", error);
    editAlert.textContent = 'Failed to update player: ' + (error.message || 'Please try again.');
    editAlert.style.display = 'block';
  } finally {
    saveEditBtn.disabled = false;
  }
});

// Delete Modal Handling
function openDeleteModal(id) {
  deletePlayerId = id;
  deleteModal.classList.add('active');
}

cancelDeleteBtn.addEventListener('click', () => {
  deleteModal.classList.remove('active');
  deletePlayerId = null;
});

confirmDeleteBtn.addEventListener('click', async () => {
  if (!deletePlayerId) return;
  confirmDeleteBtn.disabled = true;
  try {
    const deletedPlayer = players.find(p => p.id === deletePlayerId);
    const deletedKit = deletedPlayer ? Number(deletedPlayer.kitNumber) : null;

    await deleteDoc(doc(db, 'players', deletePlayerId));

    // If deleted doc was primary doc (e.g. "10"), promote another player with kit 10 if one exists
    if (deletedKit !== null && deletePlayerId === String(deletedKit)) {
      const otherPlayerWithSameKit = players.find(p => p.id !== deletePlayerId && Number(p.kitNumber) === deletedKit);
      if (otherPlayerWithSameKit) {
        const { amount } = getPaymentInfo(otherPlayerWithSameKit);
        const primaryRef = doc(db, 'players', String(deletedKit));
        const dataToPromote = {
          name: otherPlayerWithSameKit.name,
          kitNumber: deletedKit,
          chestSize: otherPlayerWithSameKit.chestSize,
          lengthSize: otherPlayerWithSameKit.lengthSize,
          kitSize: otherPlayerWithSameKit.kitSize,
          paidAmount: amount,
          isPaid: amount >= KIT_COST,
          createdAt: otherPlayerWithSameKit.createdAt || serverTimestamp()
        };
        await setDoc(primaryRef, dataToPromote);
        await deleteDoc(doc(db, 'players', otherPlayerWithSameKit.id));
      }
    }

    deleteModal.classList.remove('active');
    showAlert('Player deleted successfully', 'success');
  } catch (error) {
    console.error("Failed to delete player:", error);
    showAlert('Failed to delete player.', 'error');
  } finally {
    confirmDeleteBtn.disabled = false;
    deletePlayerId = null;
  }
});

function showAlert(msg, type) {
  dashboardAlert.textContent = msg;
  dashboardAlert.className = `alert ${type}`;
  dashboardAlert.style.display = 'block';
  setTimeout(() => {
    dashboardAlert.style.display = 'none';
  }, 4000);
}
