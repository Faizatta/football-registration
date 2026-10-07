import { auth } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

const loginForm = document.getElementById('login-form');
const loginAlert = document.getElementById('login-alert');
const loginBtn = document.getElementById('login-btn');

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = '/admin/';
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  loginAlert.style.display = 'none';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle the redirect
  } catch (error) {
    loginAlert.textContent = 'Invalid email or password.';
    loginAlert.style.display = 'block';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});
