// ============================================================
// auth.js — Autenticación Custom Multi-Rol (Clientes, Técnicos, Admin)
// InformaticaVES | El Técnico Luis
// ============================================================

import {
  auth, db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  guardarCliente, getCliente, getClienteByWA,
  guardarTecnico, getTecnico, getTecnicoByWA,
  sha256, loginClienteByHash, setClientePasswordHash,
  doc, setDoc, serverTimestamp
} from './firebase.js';

// ── Constantes ───────────────────────────────────────────────
const ADMIN_EMAIL    = 'tecnicouzcategui@gmail.com';
const WA_KEY         = 'ives_wa_number';
const ROLE_KEY       = 'ives_user_role';

// ── Estado global ────────────────────────────────────────────
export let currentUser = null;
export let isAdmin     = false;
export let isTecnico   = false;
export let userRol     = null; // 'admin' | 'tecnico' | 'solicitante'
export let userWhatsApp = null;
export let userNombre   = null;
export let tecnicoData  = null;

// ── Callbacks registrados ────────────────────────────────────
const authListeners = [];
let _authResolved = false;

export function onAuthChange(fn) {
  authListeners.push(fn);
  if (_authResolved) {
    try { fn(currentUser, isAdmin, isTecnico, userRol); } catch(e) { console.error(e); }
  }
}

function notifyListeners() {
  _authResolved = true;
  authListeners.forEach(fn => { try { fn(currentUser, isAdmin, isTecnico, userRol); } catch(e) { console.error(e); } });
}

// ── Auth Modal Custom Multi-Rol ──────────────────────────────
export function openAuthModal(defaultTab = 'solicitante') {
  let modal = document.getElementById('modal-auth-custom');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-auth-custom';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 460px; padding: 2rem; position: relative; border: 1px solid rgba(99,179,237,0.25);">
        <button id="auth-close" style="position:absolute; right:15px; top:15px; background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
        
        <!-- Selector de Rol -->
        <div class="auth-role-tabs" style="display:flex; gap:0.5rem; background:rgba(0,0,0,0.3); padding:4px; border-radius:12px; margin-bottom:1.5rem;">
          <button type="button" id="tab-rol-solicitante" class="btn btn-sm w-full" style="background:var(--blue); color:white; border-radius:8px; font-weight:600; font-size:0.82rem; transition:all 0.2s;">👤 Solicitante</button>
          <button type="button" id="tab-rol-tecnico" class="btn btn-sm w-full" style="background:transparent; color:var(--text-muted); border-radius:8px; font-weight:600; font-size:0.82rem; transition:all 0.2s;">⚡ Soy Técnico</button>
        </div>

        <h3 id="auth-modal-title" style="margin-bottom:0.35rem; text-align:center; font-size:1.25rem;">Acceso de Solicitantes</h3>
        <p id="auth-modal-desc" style="text-align:center; color:var(--text-muted); font-size:0.82rem; margin-bottom:1.25rem;">Ingresa con tu WhatsApp para solicitar servicios técnicos.</p>
        
        <div class="form-group" style="margin-bottom:1rem;">
          <label class="form-label">WhatsApp (Solo números)</label>
          <input type="tel" id="auth-wa" class="form-input" placeholder="04121234567" maxlength="15">
        </div>
        
        <div class="form-group" style="position:relative; margin-bottom:0.5rem;">
          <label class="form-label">Contraseña</label>
          <input type="password" id="auth-pass" class="form-input" placeholder="Tu contraseña">
          <button id="auth-toggle-pass" style="position:absolute; right:10px; top:36px; background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer;">👁️</button>
        </div>
        
        <div class="auth-dots" style="display:flex; flex-direction:column; gap:0.35rem; margin-bottom:1.25rem; font-size:0.75rem; color:var(--text-dim);">
          <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-letters" style="width:8px;height:8px;border-radius:50%;background:var(--red);transition:background 0.3s;"></div> Mínimo 4 letras</div>
          <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-upper" style="width:8px;height:8px;border-radius:50%;background:var(--red);transition:background 0.3s;"></div> Al menos 1 mayúscula</div>
          <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-numbers" style="width:8px;height:8px;border-radius:50%;background:var(--red);transition:background 0.3s;"></div> Mínimo 4 números</div>
        </div>

        <!-- Campos de registro para Solicitante -->
        <div id="auth-register-fields" style="display:none; margin-bottom:1.25rem; background:rgba(99,179,237,0.06); padding:1rem; border-radius:10px; border:1px dashed rgba(99,179,237,0.3);">
          <p style="color:var(--accent); font-size:0.82rem; margin-bottom:0.75rem; text-align:center; font-weight:700;">👤 Registro de Solicitante / Cliente</p>
          
          <div class="form-group" style="margin-bottom:0.6rem;">
            <label class="form-label">Nombre y Apellido *</label>
            <input type="text" id="auth-nombre" class="form-input" placeholder="Ej: Carlos Pérez">
          </div>

          <div class="form-group" style="margin-bottom:0.6rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
            <div>
              <label class="form-label">Cédula / RIF</label>
              <input type="text" id="auth-cedula" class="form-input" placeholder="V-12345678">
            </div>
            <div>
              <label class="form-label">Empresa / Gerencia</label>
              <input type="text" id="auth-empresa" class="form-input" placeholder="Ej: Particular / Gerencia IT">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Correo Electrónico (Opcional)</label>
            <input type="email" id="auth-email-solicitante" class="form-input" placeholder="correo@ejemplo.com">
          </div>
        </div>

        <!-- Campos de registro para Técnico -->
        <div id="auth-tecnico-fields" style="display:none; margin-bottom:1.25rem; background:rgba(246,173,85,0.08); padding:1rem; border-radius:10px; border:1px dashed rgba(246,173,85,0.3);">
          <p style="color:#f6ad55; font-size:0.82rem; margin-bottom:0.75rem; text-align:center; font-weight:700;">🛠️ Registro de Técnico Profesional Help Desk</p>
          
          <div class="form-group" style="margin-bottom:0.6rem;">
            <label class="form-label">Nombre Completo *</label>
            <input type="text" id="tec-nombre" class="form-input" placeholder="Ej: Luis Rodríguez">
          </div>

          <div class="form-group" style="margin-bottom:0.6rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
            <div>
              <label class="form-label">Cédula / Doc. *</label>
              <input type="text" id="tec-cedula" class="form-input" placeholder="V-12345678">
            </div>
            <div>
              <label class="form-label">Años de Exp. *</label>
              <input type="number" id="tec-exp" class="form-input" placeholder="Ej: 5" min="0">
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0.6rem;">
            <label class="form-label">Zona o Ciudad de Cobertura *</label>
            <input type="text" id="tec-zona" class="form-input" placeholder="Ej: Caracas Este, Chacao, Guarenas">
          </div>

          <div class="form-group" style="margin-bottom:0.6rem;">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" id="tec-email" class="form-input" placeholder="tecnico@ejemplo.com">
          </div>

          <div class="form-group" style="margin-bottom:0.25rem;">
            <label class="form-label" style="margin-bottom:0.4rem; display:block;">Especialidades Técnicas:</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; font-size:0.78rem; color:var(--text-muted);">
              <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;"><input type="checkbox" name="tec_esp" value="Soporte PC / Laptops"> 💻 PC & Laptops</label>
              <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;"><input type="checkbox" name="tec_esp" value="Redes & WiFi"> 📡 Redes & WiFi</label>
              <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;"><input type="checkbox" name="tec_esp" value="CCTV & Cámaras"> 📹 CCTV & Cámaras</label>
              <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;"><input type="checkbox" name="tec_esp" value="Linux & Servidores"> 🐧 Linux & Servers</label>
              <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;"><input type="checkbox" name="tec_esp" value="Impresoras & Periféricos"> 🖨️ Impresoras / Hardware</label>
              <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;"><input type="checkbox" name="tec_esp" value="Software & Sistemas"> 🌐 Software & Web</label>
            </div>
          </div>
        </div>
        
        <button id="auth-btn-submit" class="btn btn-primary w-full" disabled style="opacity:0.5; margin-bottom:0.5rem; font-weight:700;">Ingresar</button>
        <a id="auth-forgot-pass" style="color:var(--blue); font-size:0.82rem; cursor:pointer; display:block; text-align:center; margin-top:0.75rem; text-decoration:underline;">¿Olvidaste tu contraseña?</a>
        
        <div id="auth-forgot-panel" style="display:none; background:rgba(99,179,237,0.1); border:1px solid var(--blue); padding:1rem; border-radius:8px; margin-top:1rem; text-align:center;">
          <p style="font-size:0.82rem; color:var(--text); margin-bottom:0.75rem;">Se abrirá WhatsApp para solicitar a Soporte el reinicio de tu clave.</p>
          <button id="auth-btn-recover" class="btn btn-sm" style="background:#25D366; color:white; border:none; width:100%;">💬 Recuperar por WhatsApp</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Variables internas
    let selectedRole = defaultTab;

    const tabSolicitante = document.getElementById('tab-rol-solicitante');
    const tabTecnico     = document.getElementById('tab-rol-tecnico');
    const modalTitle     = document.getElementById('auth-modal-title');
    const modalDesc      = document.getElementById('auth-modal-desc');
    const passInput      = document.getElementById('auth-pass');
    const waInput        = document.getElementById('auth-wa');
    const toggleBtn      = document.getElementById('auth-toggle-pass');
    const submitBtn      = document.getElementById('auth-btn-submit');
    const closeBtn       = document.getElementById('auth-close');
    const dotLetters     = document.getElementById('dot-letters');
    const dotUpper       = document.getElementById('dot-upper');
    const dotNumbers     = document.getElementById('dot-numbers');
    const forgotPassLink = document.getElementById('auth-forgot-pass');
    const forgotPanel    = document.getElementById('auth-forgot-panel');
    const recoverBtn     = document.getElementById('auth-btn-recover');

    function switchRole(role) {
      selectedRole = role;
      if (role === 'tecnico') {
        tabTecnico.style.background = '#f6ad55';
        tabTecnico.style.color = '#1a202c';
        tabSolicitante.style.background = 'transparent';
        tabSolicitante.style.color = 'var(--text-muted)';
        modalTitle.textContent = 'Acceso de Técnicos';
        modalDesc.textContent = 'Ingresa con tu WhatsApp para gestionar tus trabajos asignados.';
      } else {
        tabSolicitante.style.background = 'var(--blue)';
        tabSolicitante.style.color = 'white';
        tabTecnico.style.background = 'transparent';
        tabTecnico.style.color = 'var(--text-muted)';
        modalTitle.textContent = 'Acceso de Solicitantes';
        modalDesc.textContent = 'Ingresa con tu WhatsApp para solicitar y seguir tus servicios.';
      }
      document.getElementById('auth-register-fields').style.display = 'none';
      document.getElementById('auth-tecnico-fields').style.display = 'none';
      submitBtn.textContent = 'Ingresar';
      revalidatePassword();
    }

    tabSolicitante.addEventListener('click', () => switchRole('solicitante'));
    tabTecnico.addEventListener('click', () => switchRole('tecnico'));

    forgotPassLink.addEventListener('click', () => {
      forgotPanel.style.display = forgotPanel.style.display === 'none' ? 'block' : 'none';
    });

    recoverBtn.addEventListener('click', () => {
      const wa = waInput.value.trim().replace(/[^\d]/g, '');
      if (!wa || wa.length < 10) {
        showToast('Ingresa tu número de WhatsApp arriba primero.', 'error');
        return;
      }
      const adminWa = '584242964339';
      const text = `Hola Soporte InformaticaVES, soy ${selectedRole === 'tecnico' ? 'el técnico' : 'el usuario'} con WhatsApp ${wa} y solicito restablecer mi contraseña.`;
      window.open(`https://wa.me/${adminWa}?text=${encodeURIComponent(text)}`, '_blank');
      showToast('Se abrió WhatsApp para solicitar el reinicio.', 'info');
    });

    toggleBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        passInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    });

    function revalidatePassword() {
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
    }

    passInput.addEventListener('input', revalidatePassword);
    waInput.addEventListener('input', () => {
      waInput.value = waInput.value.replace(/[^0-9]/g, '');
      revalidatePassword();
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('open'));

    submitBtn.addEventListener('click', async () => {
      const wa = waInput.value.trim();
      const pass = passInput.value;
      const fakeEmail = `${wa}@informaticaves.app`;
      
      const isRegisteringSolicitante = document.getElementById('auth-register-fields').style.display !== 'none';
      const isRegisteringTecnico     = document.getElementById('auth-tecnico-fields').style.display !== 'none';

      submitBtn.textContent = 'Procesando...';
      submitBtn.disabled = true;

      try {
        if (isRegisteringTecnico) {
          // ── REGISTRO DE TÉCNICO
          const nombre = document.getElementById('tec-nombre').value.trim();
          const cedula = document.getElementById('tec-cedula').value.trim();
          const exp    = document.getElementById('tec-exp').value.trim();
          const zona   = document.getElementById('tec-zona').value.trim();
          const emailInput = document.getElementById('tec-email')?.value.trim() || '';
          const espNodes = document.querySelectorAll('input[name="tec_esp"]:checked');
          const especialidades = Array.from(espNodes).map(n => n.value);

          if (!nombre) { showToast('Ingresa tu nombre completo', 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Crear Cuenta de Técnico'; return; }
          if (especialidades.length === 0) { showToast('Selecciona al menos una especialidad', 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Crear Cuenta de Técnico'; return; }

          const hash = await sha256(pass);
          const res = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
          
          await guardarTecnico(res.user.uid, {
            uid: res.user.uid,
            email: fakeEmail,
            emailPersonal: emailInput,
            nombre: nombre,
            whatsapp: wa,
            cedula: cedula,
            experiencia: exp || '0',
            zona: zona || 'General',
            especialidades: especialidades,
            estado: 'activo',
            disponible: true,
            passwordHash: hash,
            rol: 'tecnico'
          });

          localStorage.setItem(ROLE_KEY, 'tecnico');
          localStorage.setItem(WA_KEY, wa);
          showToast('✅ ¡Cuenta de Técnico creada exitosamente!', 'success');
          modal.classList.remove('open');
          window.location.href = 'tecnico.html';
          return;

        } else if (isRegisteringSolicitante) {
          // ── REGISTRO DE SOLICITANTE
          const nombre  = document.getElementById('auth-nombre').value.trim();
          const cedula  = document.getElementById('auth-cedula')?.value.trim() || '';
          const empresa = document.getElementById('auth-empresa')?.value.trim() || '';
          const emailInput = document.getElementById('auth-email-solicitante')?.value.trim() || '';

          if (!nombre) { showToast('Por favor ingresa tu nombre', 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Crear Cuenta de Solicitante'; return; }
          
          const hash = await sha256(pass);
          const res = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
          
          await guardarCliente(res.user.uid, {
            uid: res.user.uid,
            email: fakeEmail,
            emailPersonal: emailInput,
            nombre: nombre,
            cedula: cedula,
            empresa: empresa,
            whatsapp: wa,
            passwordHash: hash,
            rol: 'solicitante'
          });

          localStorage.setItem(ROLE_KEY, 'solicitante');
          localStorage.setItem(WA_KEY, wa);
          showToast('✅ Cuenta de Solicitante creada con éxito', 'success');
          modal.classList.remove('open');
          return;

        } else {
          // ── LOGIN GENERAL: Detectar si es Técnico, Solicitante o Admin
          const tecExistente = await getTecnicoByWA(wa);
          const cliExistente = await getClienteByWA(wa);

          if (!tecExistente && !cliExistente) {
            // Usuario NUEVO -> Mostrar formulario según el tab actual
            if (selectedRole === 'tecnico') {
              document.getElementById('auth-tecnico-fields').style.display = 'block';
              submitBtn.textContent = 'Crear Cuenta de Técnico';
            } else {
              document.getElementById('auth-register-fields').style.display = 'block';
              submitBtn.textContent = 'Crear Cuenta de Solicitante';
            }
            submitBtn.disabled = false;
            showToast('Número no registrado. Completa los datos para registrarte.', 'info');
            return;
          }

          // Intentar Login con Firebase Auth
          try {
            await signInWithEmailAndPassword(auth, fakeEmail, pass);
            showToast('✅ Sesión iniciada', 'success');
            modal.classList.remove('open');
            
            if (tecExistente) {
              localStorage.setItem(ROLE_KEY, 'tecnico');
              if (window.location.pathname.endsWith('solicitud.html') || window.location.pathname.endsWith('index.html')) {
                window.location.href = 'tecnico.html';
              }
            } else {
              localStorage.setItem(ROLE_KEY, 'solicitante');
            }
          } catch (e) {
            // Verificar si tiene passwordHash en Firestore (recuperación/hash directo)
            const hash = await sha256(pass);
            const loginPorHash = await loginClienteByHash(wa, hash);
            if (loginPorHash || (tecExistente && tecExistente.passwordHash === hash)) {
              showToast('✅ Sesión iniciada', 'success');
              modal.classList.remove('open');
              if (tecExistente) {
                localStorage.setItem(ROLE_KEY, 'tecnico');
                window.location.href = 'tecnico.html';
              }
            } else {
              showToast('❌ Contraseña incorrecta. Revisa e intenta de nuevo.', 'error');
              submitBtn.disabled = false;
              submitBtn.textContent = 'Ingresar';
            }
          }
        }
      } catch (err) {
        console.error('[Auth]', err);
        const msgs = {
          'auth/wrong-password': 'Contraseña incorrecta.',
          'auth/invalid-credential': 'Contraseña incorrecta.',
          'auth/email-already-in-use': 'Este número ya tiene una cuenta registrada.',
        };
        showToast(msgs[err.code] || 'Error: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ingresar';
      }
    });
  }

  // Configurar estado inicial al abrir
  document.getElementById('auth-wa').value = '';
  document.getElementById('auth-pass').value = '';
  document.getElementById('auth-pass').type = 'password';
  document.getElementById('auth-toggle-pass').textContent = '👁️';
  document.getElementById('auth-register-fields').style.display = 'none';
  document.getElementById('auth-tecnico-fields').style.display = 'none';
  document.getElementById('auth-btn-submit').textContent = 'Ingresar';
  document.getElementById('auth-btn-submit').disabled = true;
  document.getElementById('auth-btn-submit').style.opacity = 0.5;
  document.getElementById('dot-letters').style.background = 'var(--red)';
  document.getElementById('dot-upper').style.background = 'var(--red)';
  document.getElementById('dot-numbers').style.background = 'var(--red)';
  document.getElementById('auth-forgot-panel').style.display = 'none';

  if (defaultTab === 'tecnico') {
    document.getElementById('tab-rol-tecnico')?.click();
  } else {
    document.getElementById('tab-rol-solicitante')?.click();
  }

  modal.classList.add('open');
}

export const loginGoogle = openAuthModal;

// ── Login de Admin ───────────────────────────────────────────
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
  localStorage.removeItem(ROLE_KEY);
  
  currentUser  = null;
  isAdmin      = false;
  isTecnico    = false;
  userRol      = null;
  userWhatsApp = null;
  userNombre   = null;
  tecnicoData  = null;
  
  try {
    await signOut(auth);
  } catch (_) {}
  
  notifyListeners();
  updateNavUI();
  
  window.location.href = 'index.html';
}

// ── Modo Admin Local ─────────────────────────────────────────
const LOCAL_ADMIN_KEY = 'ives_local_admin';

export function forceAdmin() {
  currentUser = { displayName: 'Admin', email: ADMIN_EMAIL, uid: 'local-admin' };
  isAdmin = true;
  isTecnico = false;
  userRol = 'admin';
  localStorage.setItem(LOCAL_ADMIN_KEY, '1');
  localStorage.setItem(ROLE_KEY, 'admin');
  updateNavUI();
  notifyListeners();
}

(function restoreLocalAdmin() {
  if (localStorage.getItem(LOCAL_ADMIN_KEY) === '1') {
    currentUser = { displayName: 'Admin', email: ADMIN_EMAIL, uid: 'local-admin' };
    isAdmin = true;
    userRol = 'admin';
  }
})();

// ── Observador de sesión ─────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (localStorage.getItem(LOCAL_ADMIN_KEY) === '1') {
    currentUser = { displayName: 'Admin', email: ADMIN_EMAIL, uid: 'local-admin' };
    isAdmin = true;
    isTecnico = false;
    userRol = 'admin';
    notifyListeners();
    updateNavUI();
    import('./admin-notifications.js').then(m => m.initGlobalAdminNotifications()).catch(console.error);
    return;
  }

  currentUser  = user;
  isAdmin      = user?.email === ADMIN_EMAIL;
  isTecnico    = false;
  userRol      = isAdmin ? 'admin' : (localStorage.getItem(ROLE_KEY) || 'solicitante');
  userWhatsApp = null;
  userNombre   = null;
  tecnicoData  = null;

  if (isAdmin && user) {
    localStorage.setItem(LOCAL_ADMIN_KEY, '1');
    localStorage.setItem(ROLE_KEY, 'admin');
  }

  if (user) {
    try {
      // 1. Verificar si es Técnico
      const perfilTec = await getTecnico(user.uid);
      if (perfilTec) {
        isTecnico = true;
        userRol   = 'tecnico';
        tecnicoData = perfilTec;
        userWhatsApp = perfilTec.whatsapp;
        userNombre   = perfilTec.nombre;
        localStorage.setItem(WA_KEY, perfilTec.whatsapp);
        localStorage.setItem(ROLE_KEY, 'tecnico');
      } else {
        // 2. Verificar si es Cliente / Solicitante
        const perfilCli = await getCliente(user.uid);
        if (perfilCli) {
          userRol      = 'solicitante';
          userWhatsApp = perfilCli.whatsapp;
          userNombre   = perfilCli.nombre;
          localStorage.setItem(WA_KEY, perfilCli.whatsapp);
          localStorage.setItem(ROLE_KEY, 'solicitante');
        } else {
          // 3. Fallback por WhatsApp guardado
          const savedWa = localStorage.getItem(WA_KEY);
          if (savedWa) {
            const tecPorWa = await getTecnicoByWA(savedWa);
            if (tecPorWa) {
              isTecnico = true;
              userRol = 'tecnico';
              tecnicoData = tecPorWa;
              userWhatsApp = tecPorWa.whatsapp;
              userNombre = tecPorWa.nombre;
            } else {
              const cliPorWa = await getClienteByWA(savedWa);
              if (cliPorWa) {
                userRol = 'solicitante';
                userWhatsApp = cliPorWa.whatsapp;
                userNombre = cliPorWa.nombre;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Auth] Error cargando perfil:', e);
    }
  }

  updateNavUI();
  notifyListeners();

  if (isAdmin) {
    import('./admin-notifications.js').then(m => m.initGlobalAdminNotifications()).catch(console.error);
  } else if (userWhatsApp) {
    import('./client-notifications.js').then(m => m.initGlobalClientNotifications(userWhatsApp)).catch(console.error);
  }
});

export function getWhatsApp() {
  return userWhatsApp || localStorage.getItem(WA_KEY) || null;
}

// ── Actualizar UI de navegación ───────────────────────────────
function updateNavUI() {
  const btnLogin          = document.getElementById('btn-login');
  const userAvatar        = document.getElementById('user-avatar');
  const adminBadge        = document.getElementById('admin-badge');
  const adminLink         = document.getElementById('nav-admin');
  const navSolicitar      = document.getElementById('nav-solicitar');
  const navMisSolicitudes = document.getElementById('nav-mis-solicitudes');
  let   navTecnico        = document.getElementById('nav-tecnico');

  // Crear dinámicamente el enlace de técnico si no existe en la navbar
  const navLinksList = document.querySelector('.nav-links');
  if (navLinksList && !navTecnico) {
    const li = document.createElement('li');
    li.innerHTML = `<a href="tecnico.html" id="nav-tecnico" class="hidden">Panel Técnico</a>`;
    navLinksList.appendChild(li);
    navTecnico = document.getElementById('nav-tecnico');
  }

  if (!btnLogin) return; 

  if (currentUser) {
    btnLogin.classList.add('hidden');
    userAvatar?.classList.remove('hidden');
    
    const nameToUse = userNombre || currentUser.displayName || (isAdmin ? 'Admin' : (isTecnico ? 'Técnico' : 'Usuario'));
    const initials = nameToUse.charAt(0).toUpperCase();
    userAvatar.innerHTML = initials;

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
      if (adminBadge) adminBadge.textContent = 'Administrador';
      adminLink?.classList.remove('hidden');
      navTecnico?.classList.remove('hidden');
      navSolicitar?.closest('li')?.classList.add('hidden');
      navMisSolicitudes?.closest('li')?.classList.add('hidden');
    } else if (isTecnico) {
      adminBadge?.classList.remove('hidden');
      if (adminBadge) {
        adminBadge.textContent = '⚡ Técnico';
        adminBadge.style.background = 'rgba(246,173,85,0.2)';
        adminBadge.style.color = '#f6ad55';
        adminBadge.style.borderColor = 'rgba(246,173,85,0.4)';
      }
      adminLink?.classList.add('hidden');
      navTecnico?.classList.remove('hidden');
      navSolicitar?.closest('li')?.classList.add('hidden');
      navMisSolicitudes?.closest('li')?.classList.add('hidden');
    } else {
      adminBadge?.classList.add('hidden');
      adminLink?.classList.add('hidden');
      navTecnico?.classList.add('hidden');
      navSolicitar?.closest('li')?.classList.remove('hidden');
      navMisSolicitudes?.closest('li')?.classList.remove('hidden');
    }
  } else {
    btnLogin?.classList.remove('hidden');
    userAvatar?.classList.add('hidden');
    adminBadge?.classList.add('hidden');
    adminLink?.classList.add('hidden');
    navTecnico?.classList.add('hidden');
    navSolicitar?.closest('li')?.classList.remove('hidden');
    navMisSolicitudes?.closest('li')?.classList.remove('hidden');
  }
}

// ── Menú desplegable de Perfil ─────────────────────────────────
function openProfileDropdown(avatarEl) {
  const existing = document.getElementById('profile-dropdown');
  if (existing) { existing.remove(); return; }

  const nameToUse  = userNombre || currentUser?.displayName || (isAdmin ? 'Administrador' : (isTecnico ? 'Técnico' : 'Solicitante'));
  const waToUse    = userWhatsApp || localStorage.getItem(WA_KEY) || '—';
  const roleLabel  = isAdmin ? '👑 Super Admin' : (isTecnico ? '⚡ Técnico Especialista' : '👤 Solicitante');

  const dropdown = document.createElement('div');
  dropdown.id = 'profile-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    top: 64px;
    right: 1rem;
    background: var(--bg-card, #1e293b);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 1rem;
    padding: 1.25rem;
    min-width: 250px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    z-index: 9999;
    animation: fadeInDown 0.2s ease;
  `;

  dropdown.innerHTML = `
    <style>
      @keyframes fadeInDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      #profile-dropdown .pd-avatar {
        width: 52px; height: 52px; border-radius: 50%;
        background: ${isTecnico ? 'linear-gradient(135deg, #f6ad55, #ed8936)' : 'linear-gradient(135deg, #6366f1, #06b6d4)'};
        display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem; font-weight: 700; color: white;
        margin: 0 auto 0.75rem;
      }
      #profile-dropdown .pd-name { font-weight: 700; font-size: 1rem; color: var(--text, #fff); text-align: center; margin-bottom: 0.2rem; }
      #profile-dropdown .pd-role { font-size: 0.78rem; font-weight: 700; color: ${isTecnico ? '#f6ad55' : 'var(--blue)'}; text-align: center; margin-bottom: 0.4rem; }
      #profile-dropdown .pd-info { font-size: 0.8rem; color: var(--text-muted, #94a3b8); text-align: center; margin-bottom: 0.25rem; }
      #profile-dropdown .pd-link-btn {
        display: block; width: 100%; text-align: center; padding: 0.5rem; margin-top: 0.5rem; border-radius: 0.5rem;
        background: rgba(99,179,237,0.15); color: var(--blue, #63b3ed); font-size: 0.82rem; font-weight: 600; text-decoration: none;
      }
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
    <div class="pd-role">${roleLabel}</div>
    ${waToUse !== '—' ? `<div class="pd-info">📱 ${waToUse}</div>` : ''}
    ${isTecnico ? `<a href="tecnico.html" class="pd-link-btn">⚡ Ir a mi Panel de Técnico</a>` : ''}
    ${isAdmin ? `<a href="admin.html" class="pd-link-btn">🛠️ Ir al Panel Administrador</a>` : ''}
    <hr class="pd-divider">
    <button class="pd-btn-logout" id="pd-logout-btn">🚪 Cerrar Sesión</button>
  `;

  document.body.appendChild(dropdown);

  document.getElementById('pd-logout-btn').addEventListener('click', async () => {
    dropdown.remove();
    await logout();
  });

  setTimeout(() => {
    document.addEventListener('click', function handler() {
      dropdown.remove();
      document.removeEventListener('click', handler);
    });
  }, 50);
}

// ── Toast helper ──────────────────────────────────────────────
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
window._showToast = showToast;

export function getUserDisplayName() {
  return userNombre || currentUser?.displayName || (isTecnico ? 'Técnico' : 'Cliente');
}

export function getUserEmail() {
  return currentUser?.email || '';
}

// ── Soporte Capacitor APK ─────────────────────────────────────
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
