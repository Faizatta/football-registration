import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

const mainContent = document.getElementById('main-content');
const logoutBtn = document.getElementById('logout-btn');
const playersTbody = document.getElementById('players-tbody');
const searchInput = document.getElementById('search-input');
const exportBtn = document.getElementById('export-btn');
const dashboardAlert = document.getElementById('dashboard-alert');

// Edit Modal
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const cancelEditBtn = document.getElementById('cancel-edit');
const editAlert = document.getElementById('edit-alert');
const saveEditBtn = document.getElementById('save-edit');

// Delete Modal
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

let players = [];
let deletePlayerId = null;

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
    snapshot.forEach((doc) => {
      players.push({ id: doc.id, ...doc.data() });
    });
    // Sort by kit number or registration date
    players.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    renderTable(players);
  });
}

function renderTable(data) {
  playersTbody.innerHTML = '';
  data.forEach(player => {
    const tr = document.createElement('tr');
    
    let dateStr = 'N/A';
    if (player.createdAt) {
      dateStr = new Date(player.createdAt.toMillis()).toLocaleString();
    }

    tr.innerHTML = `
      <td>${escapeHTML(player.name)}</td>
      <td>${escapeHTML(String(player.kitNumber))}</td>
      <td>${escapeHTML(player.chestSize)}</td>
      <td>${escapeHTML(player.lengthSize)}</td>
      <td>${escapeHTML(player.kitSize)}</td>
      <td>${escapeHTML(dateStr)}</td>
      <td class="actions">
        <button class="btn-secondary edit-btn" data-id="${player.id}">Edit</button>
        <button class="btn-danger delete-btn" data-id="${player.id}">Delete</button>
      </td>
    `;
    playersTbody.appendChild(tr);
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => openEditModal(e.target.dataset.id));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => openDeleteModal(e.target.dataset.id));
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = players.filter(p => 
    p.name.toLowerCase().includes(term) || String(p.kitNumber).includes(term)
  );
  renderTable(filtered);
});

exportBtn.addEventListener('click', () => {
  if (players.length === 0) return;
  
  const headers = ['Player Name', 'Kit Number', 'Chest Size', 'Length Size', 'Kit Size', 'Registration Date'];
  const csvRows = [];
  csvRows.push(headers.join(','));

  players.forEach(p => {
    const dateStr = p.createdAt ? new Date(p.createdAt.toMillis()).toLocaleString().replace(/,/g, '') : 'N/A';
    const values = [
      `"${p.name.replace(/"/g, '""')}"`,
      p.kitNumber,
      `"${p.chestSize}"`,
      `"${p.lengthSize}"`,
      `"${p.kitSize}"`,
      dateStr
    ];
    csvRows.push(values.join(','));
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', 'football-players.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

function openEditModal(id) {
  const player = players.find(p => p.id === id);
  if (!player) return;

  document.getElementById('edit-original-kit').value = player.kitNumber;
  document.getElementById('edit-name').value = player.name;
  document.getElementById('edit-kit').value = player.kitNumber;
  document.getElementById('edit-chest').value = player.chestSize;
  document.getElementById('edit-length').value = player.lengthSize;
  document.getElementById('edit-kit-size').value = player.kitSize;
  
  editAlert.style.display = 'none';
  editModal.classList.add('active');
}

cancelEditBtn.addEventListener('click', () => {
  editModal.classList.remove('active');
});

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveEditBtn.disabled = true;
  editAlert.style.display = 'none';

  const originalKit = document.getElementById('edit-original-kit').value;
  const newKit = document.getElementById('edit-kit').value;
  
  try {
    if (originalKit !== newKit) {
      // Check if new kit is available
      const docRef = doc(db, 'players', newKit);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        editAlert.textContent = `Kit number ${newKit} is already taken.`;
        editAlert.style.display = 'block';
        saveEditBtn.disabled = false;
        return;
      }
      
      // Need to create new doc and delete old doc because document ID is the kit number
      const oldDocRef = doc(db, 'players', originalKit);
      const oldDocSnap = await getDoc(oldDocRef);
      
      const newPlayerData = {
        name: document.getElementById('edit-name').value,
        kitNumber: Number(newKit),
        chestSize: document.getElementById('edit-chest').value,
        lengthSize: document.getElementById('edit-length').value,
        kitSize: document.getElementById('edit-kit-size').value,
        createdAt: oldDocSnap.data().createdAt
      };

      await setDoc(docRef, newPlayerData);
      await deleteDoc(oldDocRef);
    } else {
      // Just update existing doc
      const docRef = doc(db, 'players', originalKit);
      await updateDoc(docRef, {
        name: document.getElementById('edit-name').value,
        chestSize: document.getElementById('edit-chest').value,
        lengthSize: document.getElementById('edit-length').value,
        kitSize: document.getElementById('edit-kit-size').value
      });
    }

    editModal.classList.remove('active');
    showAlert('Player updated successfully', 'success');
  } catch (error) {
    editAlert.textContent = 'Failed to update player.';
    editAlert.style.display = 'block';
  } finally {
    saveEditBtn.disabled = false;
  }
});

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
    await deleteDoc(doc(db, 'players', deletePlayerId));
    deleteModal.classList.remove('active');
    showAlert('Player deleted successfully', 'success');
  } catch (error) {
    showAlert('Failed to delete player.', 'error');
  } finally {
    confirmDeleteBtn.disabled = false;
    deletePlayerId = null;
  }
});

function showAlert(msg, type) {
  dashboardAlert.textContent = msg;
  dashboardAlert.className = `alert ${type}`;
  setTimeout(() => {
    dashboardAlert.style.display = 'none';
  }, 3000);
}
