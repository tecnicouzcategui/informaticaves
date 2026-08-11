// ============================================================
// auth.js — Autenticación Custom con WhatsApp y Modal
// InformaticaVES | El Técnico Luis
// ============================================================

import {
  auth, db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  guardarCliente, getCliente,
  doc, setDoc, serverTimestamp
} from './firebase.js';
import { initGlobalAdminNotifications, stopGlobalAdminNotifications } from './admin-notifications.js';

// ── Constantes ───────────────────────────────────────────────
const ADMIN_EMAIL    = 'tecnicouzcategui@gmail.com';
const WA_KEY         = 'ives_wa_number';

// ── Estado global ────────────────────────────────────────────
export let currentUser = null;
export let isAdmin      = false;
export let userWhatsApp = null;
export let userNombre   = null;

// ── Callbacks registrados ────────────────────────────────────
const authListeners = [];
export function onAuthChange(fn) { authListeners.push(fn); }
function notifyListeners() { 
  if (isAdmin) initGlobalAdminNotifications(); else stopGlobalAdminNotifications();
  authListeners.forEach(fn => fn(currentUser, isAdmin)); 
}

// ── Auth Modal Custom ─────────────────────────────────────────
export function openAuthModal() {
  let modal = document.getElementById('modal-auth-custom');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-auth-custom';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 400px; padding: 2rem; position: relative;">
        <button id="auth-close" style="position:absolute; right:15px; top:15px; background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
        <h3 style="margin-bottom:0.5rem; text-align:center; font-size:1.3rem;">Acceso de Clientes</h3>
        <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-bottom:1.5rem;">Ingresa tu WhatsApp y una contraseña segura.</p>
        
        <div class="form-group" style="margin-bottom:1rem;">
          <label class="form-label">WhatsApp (Solo números)</label>
          <input type="tel" id="auth-wa" class="form-input" placeholder="04121234567" maxlength="15">
        </div>
        
        <div class="form-group" style="position:relative; margin-bottom:0.5rem;">
          <label class="form-label">Contraseña</label>
          <input type="password" id="auth-pass" class="form-input" placeholder="Tu contraseña">
          <button id="auth-toggle-pass" style="position:absolute; right:10px; top:36px; background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer;">👁️</button>
        </div>
        
        <div class="auth-dots" style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:1.5rem; font-size:0.75rem; color:var(--text-dim);">
          <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-letters" style="width:8px;height:8px;border-radius:50%;background:var(--red);transition:background 0.3s;"></div> Mínimo 4 letras</div>
          <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-upper" style="width:8px;height:8px;border-radius:50%;background:var(--red);transition:background 0.3s;"></div> Al menos 1 mayúscula</div>
          <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-numbers" style="width:8px;height:8px;border-radius:50%;background:var(--red);transition:background 0.3s;"></div> Mínimo 4 números</div>
        </div>

        <div id="auth-register-fields" style="display:none; margin-bottom:1.5rem;">
          <p style="color:var(--accent); font-size:0.8rem; margin-bottom:0.5rem; text-align:center;">¡Parece que eres nuevo! Déjanos tu nombre:</p>
          <div class="form-group">
            <label class="form-label">Tu Nombre</label>
            <input type="text" id="auth-nombre" class="form-input" placeholder="Ej: Luis Uzcátegui">
          </div>
        </div>
        
        <button id="auth-btn-submit" class="btn btn-primary w-full" disabled style="opacity:0.5; margin-bottom:0.5rem;">Ingresar</button>
      </div>
    `;
    document.body.appendChild(modal);

    // Lógica del modal
    const passInput = document.getElementById('auth-pass');
    const waInput = document.getElementById('auth-wa');
    const toggleBtn = document.getElementById('auth-toggle-pass');
    const submitBtn = document.getElementById('auth-btn-submit');
    const closeBtn = document.getElementById('auth-close');
    const dotLetters = document.getElementById('dot-letters');
    const dotUpper = document.getElementById('dot-upper');
    const dotNumbers = document.getElementById('dot-numbers');
    
    // Toggle Password Visibility
    toggleBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        passInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    });

    // Validar contraseña
    passInput.addEventListener('input', () => {
      const val = passInput.value;
      const lettersCount = (val.match(/[a-zA-Z]/g) || []).length;
      const upperCount = (val.match(/[A-Z]/g) || []).length;
      const numCount = (val.match(/[0-9]/g) || []).length;

      const hasLetters = lettersCount >= 4;
      const hasUpper = upperCount >= 1;
      const hasNumbers = numCount >= 4;

      dotLetters.style.background = hasLetters ? 'var(--green)' : 'var(--red)';
      dotUpper.style.background = hasUpper ? 'var(--green)' : 'var(--red)';
      dotNumbers.style.background = hasNumbers ? 'var(--green)' : 'var(--red)';

      if (hasLetters && hasUpper && hasNumbers && waInput.value.length >= 10) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = 1;
      } else {
        submitBtn.disabled = true;
        submitBtn.style.opacity = 0.5;
      }
    });

    waInput.addEventListener('input', () => {
      // Forzar solo números
      waInput.value = waInput.value.replace(/[^0-9]/g, '');
      passInput.dispatchEvent(new Event('input')); // Re-evaluar botón
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('open');
    });

    submitBtn.addEventListener('click', async () => {
      const wa = waInput.value.trim();
      const pass = passInput.value;
      const fakeEmail = wa + '@informaticaves.app';
      
      const isRegistering = document.getElementById('auth-register-fields').style.display !== 'none';

      submitBtn.textContent = 'Procesando...';
      submitBtn.disabled = true;

      try {
        if (isRegistering) {
          const nombre = document.getElementById('auth-nombre').value.trim();
          if (!nombre) { alert('Por favor ingresa tu nombre'); return; }
          const res = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
          await guardarCliente(res.user.uid, {
            uid: res.user.uid,
            email: fakeEmail,
            nombre: nombre,
            whatsapp: wa
          });
          showToast('✅ Cuenta creada exitosamente', 'success');
          modal.classList.remove('open');
        } else {
          try {
            await signInWithEmailAndPassword(auth, fakeEmail, pass);
            showToast('✅ Sesión iniciada', 'success');
            modal.classList.remove('open');
          } catch (e) {
            // Si el usuario no existe, mostrar campos de registro
            if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
              // Asumimos que no existe si las credenciales fallan, mostramos registro
              document.getElementById('auth-register-fields').style.display = 'block';
              submitBtn.textContent = 'Crear Cuenta Nueva';
              submitBtn.disabled = false;
              showToast('Número no registrado. Crea tu cuenta.', 'info');
            } else {
              throw e;
            }
          }
        }
      } catch (err) {
        console.error('[Auth]', err);
        const msgs = {
          'auth/wrong-password': 'Contraseña incorrecta.',
          'auth/invalid-credential': 'Contraseña incorrecta.',
          'auth/email-already-in-use': 'Este número ya tiene una cuenta. Revisa tu contraseña.',
        };
        showToast(msgs[err.code] || 'Error: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = isRegistering ? 'Crear Cuenta Nueva' : 'Ingresar';
      }
    });
  }
  
  // Limpiar campos y mostrar modal
  document.getElementById('auth-wa').value = '';
  document.getElementById('auth-pass').value = '';
  document.getElementById('auth-pass').type = 'password';
  document.getElementById('auth-toggle-pass').textContent = '👁️';
  document.getElementById('auth-register-fields').style.display = 'none';
  document.getElementById('auth-btn-submit').textContent = 'Ingresar';
  document.getElementById('auth-btn-submit').disabled = true;
  document.getElementById('auth-btn-submit').style.opacity = 0.5;
  document.getElementById('dot-letters').style.background = 'var(--red)';
  document.getElementById('dot-upper').style.background = 'var(--red)';
  document.getElementById('dot-numbers').style.background = 'var(--red)';

  modal.classList.add('open');
}

// Mantener compatibilidad con HTML existente (renombramos la función internamente)
export const loginGoogle = openAuthModal;

// ── Login de Admin (Usado en panel admin) ─────────────────────
export async function loginEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (err) {
    const msgs = {
      'auth/invalid-credential':  'Correo o contraseña incorrectos.',
      'auth/user-not-found':      'No existe una cuenta con ese correo.'
    };
    throw new Error(msgs[err.code] || err.message);
  }
}

// ── Logout ───────────────────────────────────────────────────
export async function logout() {
  localStorage.removeItem('ives_local_admin');
  localStorage.removeItem(WA_KEY);
  
  currentUser  = null;
  isAdmin      = false;
  userWhatsApp = null;
  userNombre   = null;
  
  try {
    await signOut(auth);
  } catch (_) {}
  
  notifyListeners();
  updateNavUI();
  
  window.location.href = 'index.html';
}

// ── Modo Admin Local (persiste en localStorage) ─────────────
const LOCAL_ADMIN_KEY = 'ives_local_admin';

export function forceAdmin() {
  currentUser = { displayName: 'Admin', email: 'tecnicouzcategui@gmail.com', uid: 'local-admin' };
  isAdmin = true;
  localStorage.setItem(LOCAL_ADMIN_KEY, '1');
  notifyListeners();
}

(function restoreLocalAdmin() {
  if (localStorage.getItem(LOCAL_ADMIN_KEY) === '1') {
    currentUser = { displayName: 'Admin', email: 'tecnicouzcategui@gmail.com', uid: 'local-admin' };
    isAdmin = true;
  }
})();

// ── Observador de sesión ─────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (localStorage.getItem(LOCAL_ADMIN_KEY) === '1') {
    currentUser = { displayName: 'Admin', email: 'tecnicouzcategui@gmail.com', uid: 'local-admin' };
    isAdmin = true;
    notifyListeners();
    updateNavUI();
    return;
  }

  currentUser  = user;
  isAdmin      = user?.email === ADMIN_EMAIL;
  userWhatsApp = null;
  userNombre   = null;

  if (user) {
    try {
      const perfil = await getCliente(user.uid);
      if (perfil) {
        userWhatsApp = perfil.whatsapp;
        userNombre   = perfil.nombre;
        localStorage.setItem(WA_KEY, perfil.whatsapp);
      }
    } catch (_) {}
  }

  updateNavUI();
  notifyListeners();
});

// ── Actualizar UI de navegación ───────────────────────────────
function updateNavUI() {
  const btnLogin   = document.getElementById('btn-login');
  const userAvatar = document.getElementById('user-avatar');
  const adminBadge = document.getElementById('admin-badge');
  const adminLink  = document.getElementById('nav-admin');

  if (!btnLogin) return; 

  if (currentUser) {
    btnLogin.classList.add('hidden');
    userAvatar?.classList.remove('hidden');
    
    const nameToUse = userNombre || currentUser.displayName || currentUser.email || 'U';
    const initials = nameToUse.charAt(0).toUpperCase();
    userAvatar.innerHTML = initials;

    // Adjuntar menú de perfil al avatar (solo una vez)
    if (!userAvatar.dataset.profileBound) {
      userAvatar.dataset.profileBound = '1';
      userAvatar.style.cursor = 'pointer';
      userAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        openProfileDropdown(userAvatar);
      });
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

// ── Funciones dummy de compatibilidad para evitar errores en HTML viejo ──
export function openWhatsAppModal() {}
export function closeWhatsAppModal() {}
export function saveWhatsApp() {}

// ── Menú desplegable de Perfil ─────────────────────────────────
function openProfileDropdown(avatarEl) {
  // Eliminar dropdown anterior si existe
  const existing = document.getElementById('profile-dropdown');
  if (existing) { existing.remove(); return; }

  const nameToUse  = userNombre || currentUser?.displayName || 'Usuario';
  const waToUse    = userWhatsApp || localStorage.getItem(WA_KEY) || '—';
  const emailToUse = currentUser?.email || '';
  // Ocultar el email tipo "04xx@informaticaves.app" que es interno
  const emailDisplay = emailToUse.includes('@informaticaves.app') ? '' : emailToUse;

  const dropdown = document.createElement('div');
  dropdown.id = 'profile-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    top: 64px;
    right: 1rem;
    background: var(--bg-card, #1e293b);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 1rem;
    padding: 1.25rem;
    min-width: 240px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    z-index: 9999;
    animation: fadeInDown 0.2s ease;
  `;

  dropdown.innerHTML = `
    <style>
      @keyframes fadeInDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      #profile-dropdown .pd-avatar {
        width: 52px; height: 52px; border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #06b6d4);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem; font-weight: 700; color: white;
        margin: 0 auto 0.75rem;
      }
      #profile-dropdown .pd-name { font-weight: 700; font-size: 1rem; color: var(--text, #fff); text-align: center; margin-bottom: 0.2rem; }
      #profile-dropdown .pd-info { font-size: 0.8rem; color: var(--text-muted, #94a3b8); text-align: center; margin-bottom: 0.1rem; }
      #profile-dropdown .pd-divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 0.75rem 0; }
      #profile-dropdown .pd-btn-logout {
        width: 100%; padding: 0.6rem; border-radius: 0.5rem;
        background: rgba(252,129,129,0.1); border: 1px solid rgba(252,129,129,0.3);
        color: #fc8181; font-size: 0.875rem; font-weight: 600; cursor: pointer;
        transition: background 0.2s;
      }
      #profile-dropdown .pd-btn-logout:hover { background: rgba(252,129,129,0.2); }
    </style>
    <div class="pd-avatar">${nameToUse.charAt(0).toUpperCase()}</div>
    <div class="pd-name">${nameToUse}</div>
    ${waToUse !== '—' ? `<div class="pd-info">📱 ${waToUse}</div>` : ''}
    ${emailDisplay ? `<div class="pd-info">✉️ ${emailDisplay}</div>` : ''}
    <hr class="pd-divider">
    <button class="pd-btn-logout" id="pd-logout-btn">🚪 Cerrar Sesión</button>
  `;

  document.body.appendChild(dropdown);

  document.getElementById('pd-logout-btn').addEventListener('click', async () => {
    dropdown.remove();
    await logout();
  });

  // Cerrar al hacer clic fuera
  setTimeout(() => {
    document.addEventListener('click', function handler() {
      dropdown.remove();
      document.removeEventListener('click', handler);
    });
  }, 50);
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
  return userNombre || currentUser?.displayName || 'Cliente';
}

export function getUserEmail() {
  return currentUser?.email || '';
}

// ── Soporte Capacitor APK (Botón Atrás) ────────────────────────
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
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
