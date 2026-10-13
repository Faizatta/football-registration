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
const statPaidCount = document.getElementById('stat-paid-count');
const statPaidAmount = document.getElementById('stat-paid-amount');
const statUnpaidCount = document.getElementById('stat-unpaid-count');
const statUnpaidAmount = document.getElementById('stat-unpaid-amount');
const countAll = document.getElementById('count-all');
const countPaid = document.getElementById('count-paid');
const countUnpaid = document.getElementById('count-unpaid');

// Filter Tabs
const filterTabs = document.querySelectorAll('.filter-tab');

// Add Player Modal Elements
const addModal = document.getElementById('add-modal');
const addForm = document.getElementById('add-form');
const addPlayerBtn = document.getElementById('add-player-btn');
const cancelAddBtn = document.getElementById('cancel-add');
const cancelAddXBtn = document.getElementById('cancel-add-x');
const saveAddBtn = document.getElementById('save-add');
const addAlert = document.getElementById('add-alert');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const cancelEditBtn = document.getElementById('cancel-edit');
const cancelEditXBtn = document.getElementById('cancel-edit-x');
const editAlert = document.getElementById('edit-alert');
const saveEditBtn = document.getElementById('save-edit');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

let players = [];
let deletePlayerId = null;
let currentFilter = 'all'; // 'all' | 'paid' | 'unpaid'
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

function loadPlayers() {
  const q = query(collection(db, 'players'));
  onSnapshot(q, (snapshot) => {
    players = [];
    snapshot.forEach((docSnap) => {
      players.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort by registration date descending, fallback to kit number
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
  const paid = players.filter(p => Boolean(p.isPaid)).length;
  const unpaid = total - paid;
  const totalAmount = total * KIT_COST;
  const paidAmount = paid * KIT_COST;
  const unpaidAmount = unpaid * KIT_COST;

  if (statTotalPlayers) statTotalPlayers.textContent = total;
  if (statTotalAmount) statTotalAmount.textContent = `Total Value: Rs. ${totalAmount.toLocaleString()}`;
  if (statPaidCount) statPaidCount.textContent = paid;
  if (statPaidAmount) statPaidAmount.textContent = `Collected: Rs. ${paidAmount.toLocaleString()}`;
  if (statUnpaidCount) statUnpaidCount.textContent = unpaid;
  if (statUnpaidAmount) statUnpaidAmount.textContent = `Pending: Rs. ${unpaidAmount.toLocaleString()}`;

  if (countAll) countAll.textContent = total;
  if (countPaid) countPaid.textContent = paid;
  if (countUnpaid) countUnpaid.textContent = unpaid;
}

function getFilteredPlayers() {
  return players.filter(p => {
    const isPaid = Boolean(p.isPaid);
    if (currentFilter === 'paid' && !isPaid) return false;
    if (currentFilter === 'unpaid' && isPaid) return false;

    if (currentSearch) {
      const term = currentSearch.toLowerCase();
      const nameMatch = (p.name || '').toLowerCase().includes(term);
      const kitMatch = String(p.kitNumber || '').includes(term);
      const sizeMatch = (p.kitSize || '').toLowerCase().includes(term);
      const paidMatch = (isPaid ? 'paid' : 'unpaid').includes(term);
      return nameMatch || kitMatch || sizeMatch || paidMatch;
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
    const isPaid = Boolean(player.isPaid);
    
    let dateStr = 'N/A';
    if (player.createdAt) {
      dateStr = new Date(player.createdAt.toMillis ? player.createdAt.toMillis() : player.createdAt).toLocaleString();
    }

    tr.innerHTML = `
      <td><strong>${escapeHTML(player.name)}</strong></td>
      <td><span style="font-weight:700; color: #047857; font-size: 1.05rem;">#${escapeHTML(String(player.kitNumber))}</span></td>
      <td>${escapeHTML(player.chestSize)}</td>
      <td>${escapeHTML(player.lengthSize)}</td>
      <td><span style="background:#f3f4f6; padding: 2px 8px; border-radius: 4px; font-weight:600;">${escapeHTML(player.kitSize)}</span></td>
      <td>
        <label class="payment-cell" title="Click to toggle payment status">
          <input type="checkbox" class="payment-checkbox" data-id="${player.id}" ${isPaid ? 'checked' : ''}>
          <span class="badge ${isPaid ? 'badge-paid' : 'badge-unpaid'}">${isPaid ? '✓ Paid' : '⏳ Unpaid'}</span>
        </label>
      </td>
      <td style="font-size: 0.85rem; color: #4b5563;">${escapeHTML(dateStr)}</td>
      <td class="actions">
        <button class="btn-secondary edit-btn" data-id="${player.id}">Edit</button>
        <button class="btn-danger delete-btn" data-id="${player.id}">Delete</button>
      </td>
    `;
    playersTbody.appendChild(tr);
  });

  // Direct payment toggle checkbox listener
  document.querySelectorAll('.payment-checkbox').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const isChecked = e.target.checked;
      await togglePaymentStatus(id, isChecked);
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

async function togglePaymentStatus(playerId, isChecked) {
  try {
    const docRef = doc(db, 'players', playerId);
    await updateDoc(docRef, {
      isPaid: isChecked
    });
    const targetPlayer = players.find(p => p.id === playerId);
    const name = targetPlayer ? targetPlayer.name : 'Player';
    showAlert(`${name} marked as ${isChecked ? 'PAID (Rs. 1,700)' : 'UNPAID'}`, 'success');
  } catch (error) {
    console.error("Failed to update payment status:", error);
    showAlert("Failed to update payment status: " + error.message, "error");
    renderTable(getFilteredPlayers()); // Revert checkbox in UI
  }
}

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
    'Registration Date'
  ];
  const csvRows = [];
  csvRows.push(headers.join(','));

  players.forEach(p => {
    const isPaid = Boolean(p.isPaid);
    const dateStr = p.createdAt ? new Date(p.createdAt.toMillis ? p.createdAt.toMillis() : p.createdAt).toLocaleString().replace(/,/g, '') : 'N/A';
    const values = [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.kitNumber,
      `"${(p.chestSize || '').replace(/"/g, '""')}"`,
      `"${(p.lengthSize || '').replace(/"/g, '""')}"`,
      `"${p.kitSize || ''}"`,
      isPaid ? 'PAID' : 'UNPAID',
      isPaid ? KIT_COST : 0,
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
  showAlert('Player data with payment summary exported to CSV!', 'success');
});

// Add Player Modal Handling
if (addPlayerBtn && addModal) {
  addPlayerBtn.addEventListener('click', () => {
    addAlert.style.display = 'none';
    addForm.reset();
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
    const addPaid = document.getElementById('add-paid').checked;

    try {
      const primaryDocRef = doc(db, 'players', addKit);
      const primaryDocSnap = await getDoc(primaryDocRef);

      let targetDocRef = primaryDocRef;
      let isOverride = false;

      // If document already exists, admin override creates a unique doc ID without overwriting
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
        isPaid: addPaid,
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

  document.getElementById('edit-player-id').value = player.id;
  document.getElementById('edit-original-kit').value = player.kitNumber;
  document.getElementById('edit-name').value = player.name || '';
  document.getElementById('edit-kit').value = player.kitNumber;
  document.getElementById('edit-chest').value = player.chestSize || '';
  document.getElementById('edit-length').value = player.lengthSize || '';
  document.getElementById('edit-kit-size').value = player.kitSize || 'M';
  document.getElementById('edit-paid').checked = Boolean(player.isPaid);
  
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
  const newPaid = document.getElementById('edit-paid').checked;

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
        // Taken by someone else: create unique doc ID so we don't destroy existing player's record
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
        isPaid: newPaid,
        createdAt: oldPlayer.createdAt || serverTimestamp()
      };

      await setDoc(targetDocRef, updatedData);

      // If document ID changed, delete the old document
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
      // Kit number is the same, simply update document
      const docRef = doc(db, 'players', playerId);
      await updateDoc(docRef, {
        name: newName,
        kitNumber: Number(newKit),
        chestSize: newChest,
        lengthSize: newLength,
        kitSize: newKitSize,
        isPaid: newPaid
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

    // If deleted doc was primary doc (e.g. "10"), check if another player had kit 10 (e.g. "10_admin_xxx")
    // Promote them to primary doc "10" to keep kit 10 reserved in Firestore
    if (deletedKit !== null && deletePlayerId === String(deletedKit)) {
      const otherPlayerWithSameKit = players.find(p => p.id !== deletePlayerId && Number(p.kitNumber) === deletedKit);
      if (otherPlayerWithSameKit) {
        const primaryRef = doc(db, 'players', String(deletedKit));
        const dataToPromote = {
          name: otherPlayerWithSameKit.name,
          kitNumber: deletedKit,
          chestSize: otherPlayerWithSameKit.chestSize,
          lengthSize: otherPlayerWithSameKit.lengthSize,
          kitSize: otherPlayerWithSameKit.kitSize,
          isPaid: Boolean(otherPlayerWithSameKit.isPaid),
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
