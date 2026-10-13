import { db } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';

const form = document.getElementById('registration-form');
const kitInput = document.getElementById('kitNumber');
const kitStatus = document.getElementById('kit-status');
const registerBtn = document.getElementById('register-btn');
const globalAlert = document.getElementById('global-alert');

let debounceTimeout;
let isKitAvailable = false;

// Check kit availability
kitInput.addEventListener('input', (e) => {
  const kitNum = e.target.value;
  
  clearTimeout(debounceTimeout);
  
  if (!kitNum || kitNum <= 0) {
    kitStatus.textContent = '';
    kitStatus.className = 'status-message';
    kitInput.className = '';
    isKitAvailable = false;
    updateButtonState();
    return;
  }

  kitStatus.textContent = 'Checking...';
  kitStatus.className = 'status-message loading';
  registerBtn.disabled = true;

  debounceTimeout = setTimeout(async () => {
    try {
      const docRef = doc(db, "players", String(kitNum));
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        kitStatus.textContent = `✕ Kit number ${kitNum} is already taken. Please choose another number.`;
        kitStatus.className = 'status-message error';
        kitInput.className = 'invalid';
        isKitAvailable = false;
      } else {
        kitStatus.textContent = `✓ Kit number ${kitNum} is available.`;
        kitStatus.className = 'status-message success';
        kitInput.className = 'valid';
        isKitAvailable = true;
      }
    } catch (error) {
      kitStatus.textContent = 'Unable to check kit number. Please check your internet connection.';
      kitStatus.className = 'status-message error';
      isKitAvailable = false;
    }
    updateButtonState();
  }, 500); // 500ms debounce
});

// Update button state based on form validity and kit availability
form.addEventListener('input', updateButtonState);

function updateButtonState() {
  if (form.checkValidity() && isKitAvailable) {
    registerBtn.disabled = false;
  } else {
    registerBtn.disabled = true;
  }
}

function showAlert(message, type) {
  globalAlert.textContent = message;
  globalAlert.className = `alert ${type}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!isKitAvailable || !form.checkValidity()) return;

  registerBtn.textContent = 'Registering...';
  registerBtn.disabled = true;
  globalAlert.style.display = 'none';

  const formData = new FormData(form);
  const kitNumberStr = String(formData.get('kitNumber'));

  const playerData = {
    name: formData.get('playerName'),
    kitNumber: Number(kitNumberStr),
    chestSize: formData.get('chestSize'),
    lengthSize: formData.get('lengthSize'),
    kitSize: formData.get('kitSize'),
    isPaid: false,
    createdAt: serverTimestamp()
  };

  try {
    // We use setDoc instead of addDoc to enforce uniqueness on the database level.
    // However, setDoc overwrites if exists. We need a transaction or to check again,
    // or rely on security rules that prevent overwriting. 
    // In firestore, the simplest way is to write a rule: allow create: if !exists(...)
    // With security rules: allow create: if request.resource.data.kitNumber != null && !exists(/databases/$(database)/documents/players/$(document)); allow update: if false (for normal users).
    
    const playerRef = doc(db, "players", kitNumberStr);
    
    // Attempting to check and write. A transaction is safest from the client if security rules don't block overwrites perfectly.
    
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(playerRef);
      if (sfDoc.exists()) {
        throw new Error("Kit number already taken");
      }
      transaction.set(playerRef, playerData);
    });

    showAlert('✓ Player registered successfully!', 'success');
    form.reset();
    document.querySelectorAll('.size-pill').forEach(p => p.classList.remove('selected'));
    kitInput.className = '';
    kitStatus.textContent = '';
    isKitAvailable = false;
    updateButtonState();

  } catch (error) {
    console.error("Registration failed:", error);
    if (error.message === "Kit number already taken") {
       showAlert(`✕ Kit number ${kitNumberStr} is already taken. Please choose another number.`, 'error');
       kitStatus.textContent = `✕ Kit number ${kitNumberStr} is already taken. Please choose another number.`;
       kitStatus.className = 'status-message error';
       kitInput.className = 'invalid';
       isKitAvailable = false;
    } else {
       showAlert('Registration failed. Please try again.', 'error');
    }
  } finally {
    registerBtn.textContent = 'REGISTER PLAYER';
    updateButtonState();
  }
});

// Size Chart Modal Controls
const sizeChartModal = document.getElementById('size-chart-modal');
const openSizeChartBtn = document.getElementById('open-size-chart-btn');
const closeSizeChartBtn = document.getElementById('close-size-chart-btn');
const closeSizeChartBottomBtn = document.getElementById('close-size-chart-bottom-btn');

if (openSizeChartBtn && sizeChartModal) {
  openSizeChartBtn.addEventListener('click', () => {
    sizeChartModal.classList.add('active');
  });

  const closeSizeChart = () => {
    sizeChartModal.classList.remove('active');
  };

  if (closeSizeChartBtn) closeSizeChartBtn.addEventListener('click', closeSizeChart);
  if (closeSizeChartBottomBtn) closeSizeChartBottomBtn.addEventListener('click', closeSizeChart);

  sizeChartModal.addEventListener('click', (e) => {
    if (e.target === sizeChartModal) closeSizeChart();
  });
}

// Chart data mapping
const sizeChartData = {
  '4XS': { width: 14, length: 18 },
  '3XS': { width: 15, length: 20 },
  '2XS': { width: 16, length: 22 },
  'XS':  { width: 17, length: 24 },
  'S':   { width: 18, length: 26 },
  'M':   { width: 19, length: 27 },
  'L':   { width: 20, length: 28 },
  'XL':  { width: 21, length: 29 },
  '2XL': { width: 22, length: 29 },
  '3XL': { width: 23, length: 30 },
  '4XL': { width: 24, length: 31 },
  '5XL': { width: 25, length: 32 }
};

const chestInput = document.getElementById('chestSize');
const lengthInput = document.getElementById('lengthSize');
const sizePills = document.querySelectorAll('.size-pill');

sizePills.forEach(pill => {
  const radio = pill.querySelector('input[type="radio"]');
  radio.addEventListener('change', () => {
    sizePills.forEach(p => p.classList.remove('selected'));
    if (radio.checked) {
      pill.classList.add('selected');
      const data = sizeChartData[radio.value];
      if (data) {
        if (!chestInput.value || chestInput.dataset.autoFilled === "true") {
          chestInput.value = `${data.width} inches`;
          chestInput.dataset.autoFilled = "true";
        }
        if (!lengthInput.value || lengthInput.dataset.autoFilled === "true") {
          lengthInput.value = `${data.length} inches`;
          lengthInput.dataset.autoFilled = "true";
        }
      }
    }
    updateButtonState();
  });
});

chestInput.addEventListener('input', () => {
  chestInput.dataset.autoFilled = "false";
});
lengthInput.addEventListener('input', () => {
  lengthInput.dataset.autoFilled = "false";
});
