// ============================================================
// auth.js — Google Auth + WhatsApp Modal + Estado de Sesión
// InformaticaVES | El Técnico Luis
// ============================================================

import {
  auth, db,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged,
  signInWithEmailAndPassword,
  guardarCliente, getCliente,
  doc, setDoc, serverTimestamp
} from './firebase.js';

// ── Constantes ───────────────────────────────────────────────
const ADMIN_EMAIL    = 'tecnicouzcategui@gmail.com';
const WA_KEY         = 'ives_wa_number';
const WA_PROMPTED    = 'ives_wa_prompted';

// ── Estado global ────────────────────────────────────────────
export let currentUser = null;
export let isAdmin      = false;
export let userWhatsApp = null;

// ── Callbacks registrados ────────────────────────────────────
const authListeners = [];
export function onAuthChange(fn) { authListeners.push(fn); }
function notifyListeners() { authListeners.forEach(fn => fn(currentUser, isAdmin)); }

// ── Proveedor Google ─────────────────────────────────────────
const provider = new GoogleAuthProvider();
provider.addScope('profile');
provider.addScope('email');

// ── Login con Google ─────────────────────────────────────────
export async function loginGoogle() {
  if (window.Capacitor) {
    // En la APK no funciona OAuth de Google. Redirigimos directo al panel 
    // para que el administrador inicie sesión con correo/contraseña.
    window.location.href = 'admin.html';
    return;
  }
  try {
    // Usamos Popup en lugar de Redirect para evitar problemas en PWAs
    const result = await signInWithPopup(auth, provider);
    if (result?.user) {
      showToast('✅ Sesión iniciada', 'success');
    }
  } catch (err) {
    console.error('[Auth] Error login:', err);
    alert('Error al iniciar sesión: ' + err.message);
  }
}

// ── Login con Email y Contraseña ───────────────────────────
export async function loginEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (err) {
    console.error('[Auth] Error email login:', err);
    const msgs = {
      'auth/invalid-credential':  'Correo o contraseña incorrectos.',
      'auth/user-not-found':      'No existe una cuenta con ese correo.',
      'auth/wrong-password':      'Contraseña incorrecta.',
      'auth/too-many-requests':   'Demasiados intentos. Espera un momento.',
      'auth/network-request-failed': 'Sin conexión a internet.',
    };
    throw new Error(msgs[err.code] || err.message);
  }
}

// ── Logout ───────────────────────────────────────────────────
export async function logout() {
  localStorage.removeItem('ives_local_admin');
  await signOut(auth);
  currentUser  = null;
  isAdmin      = false;
  userWhatsApp = null;
  notifyListeners();
}

// ── Modo Admin Local (persiste en localStorage) ─────────────
const LOCAL_ADMIN_KEY = 'ives_local_admin';

export function forceAdmin() {
  currentUser = { displayName: 'Admin', email: 'tecnicouzcategui@gmail.com', uid: 'local-admin' };
  isAdmin = true;
  localStorage.setItem(LOCAL_ADMIN_KEY, '1');
  notifyListeners();
}

// Restaurar sesión local si existe al cargar la página
(function restoreLocalAdmin() {
  if (localStorage.getItem(LOCAL_ADMIN_KEY) === '1') {
    currentUser = { displayName: 'Admin', email: 'tecnicouzcategui@gmail.com', uid: 'local-admin' };
    isAdmin = true;
  }
})();

// ── Observador de sesión ─────────────────────────────────────
onAuthStateChanged(auth, async user => {
  // 1. Si es admin local, ignoramos a Firebase
  if (localStorage.getItem(LOCAL_ADMIN_KEY) === '1') {
    currentUser = { displayName: 'Admin', email: 'tecnicouzcategui@gmail.com', uid: 'local-admin' };
    isAdmin = true;
    notifyListeners();
    updateNavUI();
    return;
  }

  // 2. Si no es admin local, usamos Firebase
  currentUser  = user;
  isAdmin      = user?.email === ADMIN_EMAIL;
  userWhatsApp = null;

  if (user) {
    // Cargar WhatsApp del perfil de Firestore
    try {
      const perfil = await getCliente(user.uid);
      if (perfil?.whatsapp) {
        userWhatsApp = perfil.whatsapp;
        localStorage.setItem(WA_KEY, perfil.whatsapp);
      }
    } catch (_) {}

    // Si no tiene WhatsApp capturado, mostrar modal
    const prompted = localStorage.getItem(WA_PROMPTED);
    if (!userWhatsApp && !prompted) {
      setTimeout(() => openWhatsAppModal(), 800);
    }
  }

  updateNavUI();
  notifyListeners();
});

// ── Manejar redirect result (solo en navegador web, NO en Capacitor)
if (!window.Capacitor) {
  getRedirectResult(auth).then(result => {
    if (result?.user) {
      showToast('✅ Sesión iniciada correctamente', 'success');
    }
  }).catch(err => {
    if (err.code !== 'auth/no-current-user') {
      console.error('[Auth] Redirect error:', err);
    }
  });
}

// ── Actualizar UI de navegación ───────────────────────────────
function updateNavUI() {
  const btnLogin   = document.getElementById('btn-login');
  const userAvatar = document.getElementById('user-avatar');
  const adminBadge = document.getElementById('admin-badge');
  const adminLink  = document.getElementById('nav-admin');

  if (!btnLogin) return; // La página no tiene nav

  if (currentUser) {
    btnLogin.classList.add('hidden');
    userAvatar?.classList.remove('hidden');
    if (currentUser.photoURL) {
      userAvatar.innerHTML = `<img src="${currentUser.photoURL}" alt="${currentUser.displayName}">`;
    } else {
      const initials = (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase();
      userAvatar.innerHTML = initials;
    }

    if (isAdmin) {
      adminBadge?.classList.remove('hidden');
      adminLink?.classList.remove('hidden');
    }
  } else {
    btnLogin?.classList.remove('hidden');
    userAvatar?.classList.add('hidden');
    adminBadge?.classList.add('hidden');
    adminLink?.classList.add('hidden');
  }
}

// ── Modal de WhatsApp ─────────────────────────────────────────
export function openWhatsAppModal() {
  const modal = document.getElementById('modal-whatsapp');
  if (!modal) return;
  modal.classList.add('open');
}

export function closeWhatsAppModal() {
  const modal = document.getElementById('modal-whatsapp');
  if (!modal) return;
  modal.classList.remove('open');
  localStorage.setItem(WA_PROMPTED, '1');
}

export async function saveWhatsApp(numero) {
  userWhatsApp = numero;
  localStorage.setItem(WA_KEY, numero);
  localStorage.setItem(WA_PROMPTED, '1');

  // Guardar en Firestore si el usuario está autenticado
  if (currentUser) {
    try {
      await guardarCliente(currentUser.uid, {
        uid:        currentUser.uid,
        email:      currentUser.email,
        nombre:     currentUser.displayName,
        whatsapp:   numero,
        fotoURL:    currentUser.photoURL || null,
      });
    } catch (err) {
      console.warn('[Auth] No se pudo guardar WhatsApp en Firestore:', err);
    }
  }

  closeWhatsAppModal();
  showToast('✅ WhatsApp guardado', 'success');
}

// ── Toast helper (importable) ─────────────────────────────────
export function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container')
    || (() => {
      const d = document.createElement('div');
      d.id = 'toast-container';
      document.body.appendChild(d);
      return d;
    })();

  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Helpers de estado ─────────────────────────────────────────
export function getWhatsApp() {
  return userWhatsApp || localStorage.getItem(WA_KEY) || '';
}

export function getUserDisplayName() {
  return currentUser?.displayName || 'Cliente';
}

export function getUserEmail() {
  return currentUser?.email || '';
}

// ── Soporte Capacitor APK (Botón Atrás) ────────────────────────
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
    // Si el modal está abierto, ciérralo primero
    if (document.querySelector('.modal-backdrop.open')) {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
      return;
    }
    if (canGoBack) {
      window.history.back();
    } else {
      window.Capacitor.Plugins.App.exitApp();
    }
  });
}
