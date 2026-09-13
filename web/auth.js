import {
  auth, db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  guardarCliente, getCliente, getClienteByWA, getClienteByCedula,
  guardarTecnico, getTecnico, getTecnicoByWA, getTecnicoByCedula,
  sha256, loginClienteByHash, setClientePasswordHash,
  collection, doc, setDoc, getDocs, query, where, serverTimestamp,
  SUPER_ADMIN_DATA, isSuperAdminIdentifier, ensureSuperAdminInFirestore, COLS
} from './firebase.js';

// ── Helper: Compresión de Imagen en Cliente (JPG/PNG a Base64 optimizado) ──
function processImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.type && !file.type.startsWith('image/')) {
      return reject(new Error('El archivo debe ser una imagen válida (JPG, PNG, WEBP).'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen seleccionada.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

// ── Helper: Validación de Contraseña (6 letras y 4 números obligatorios) ────
function checkPasswordRules(val) {
  const lettersCount = (val.match(/[a-zA-Z]/g) || []).length;
  const numCount     = (val.match(/[0-9]/g) || []).length;
  const hasLetters   = lettersCount >= 6;
  const hasNumbers   = numCount >= 4;
  return { hasLetters, hasNumbers, isValid: hasLetters && hasNumbers };
}

// ── Constantes del Super Administrador ───────────────────────
export const ADMIN_EMAIL          = 'tecnicouzcategui@gmail.com';
export const SUPER_ADMIN_EMAIL    = 'tecnicouzcategui@gmail.com';
export const SUPER_ADMIN_CEDULA   = 'V-12832779';
export const SUPER_ADMIN_CEDULA_NUM = '12832779';
export const SUPER_ADMIN_NOMBRE   = 'Luis Uzcátegui';
export const SUPER_ADMIN_WA       = '04242964339';
export const SUPER_ADMIN_HASH     = '5c66770f830c15328d4b29e2aa5d59f42c12cafaeb6977b7faefe240738cf50c';

export { isSuperAdminIdentifier };

export const WA_KEY               = 'infovzla_wa_number';
export const ROLE_KEY             = 'infovzla_user_role';
export const LOCAL_ADMIN_KEY      = 'infovzla_local_admin';

// ── Verificación y Autenticación del Super Administrador ─────
export async function isSuperAdminPassword(pass) {
  if (!pass) return false;
  const clean = String(pass).trim();
  if (clean === '@Lorella1923@' || clean === 'qwerty1234') return true;
  const h1 = await sha256(clean);
  const h2 = await sha256(pass);
  const storedH = typeof localStorage !== 'undefined' ? (localStorage.getItem('infovzla_admin_hash') || localStorage.getItem('admin_password_hash')) : null;
  const knownHashes = [
    SUPER_ADMIN_HASH,
    'c78f87ae21bc7e56e45eb1959bc1f8bb0ff061db1bbe6c8923e99d79494bb027', // @Lorella1923@
    '17f80754644d33ac685b0842a402229adbb43fc9312f7bdf36ba24237a1f1ffb'  // qwerty1234
  ];
  if (storedH) knownHashes.push(storedH);
  if (knownHashes.includes(h1) || knownHashes.includes(h2)) return true;

  try {
    const cred = await Promise.race([
      signInWithEmailAndPassword(auth, ADMIN_EMAIL, pass),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
    if (cred && cred.user) return true;
  } catch (_) {}

  return false;
}

export async function loginAsSuperAdmin(pass = null, redirectUrl = null) {
  let hash = SUPER_ADMIN_HASH;
  if (pass) {
    try { hash = await sha256(pass); } catch(_) {}
  }

  localStorage.setItem(LOCAL_ADMIN_KEY, '1');
  localStorage.setItem('ives_local_admin', '1');
  localStorage.setItem(ROLE_KEY, 'admin');
  localStorage.setItem('ives_user_role', 'admin');
  localStorage.setItem('infovzla_user_cedula', 'V-12832779');
  localStorage.setItem('infovzla_user_nombre', 'Luis Uzcátegui');
  localStorage.setItem(WA_KEY, '04242964339');
  localStorage.setItem('ives_wa_number', '04242964339');
  if (hash) {
    localStorage.setItem('infovzla_admin_hash', hash);
  }

  const profile = { ...SUPER_ADMIN_DATA };
  try {
    localStorage.setItem('infovzla_tecnico_data', JSON.stringify(profile));
  } catch (_) {}

  isAdmin      = true;
  isTecnico    = true;
  userRol      = 'admin';
  userWhatsApp = '04242964339';
  userNombre   = 'Luis Uzcátegui';
  userCedula   = 'V-12832779';
  tecnicoData  = profile;
  clienteData  = null;
  currentUser  = {
    uid: '12832779',
    displayName: 'Luis Uzcátegui (Super Admin)',
    email: ADMIN_EMAIL
  };

  try {
    await Promise.race([
      ensureSuperAdminInFirestore(hash),
      new Promise(r => setTimeout(r, 1200))
    ]);
  } catch (_) {}

  notifyListeners();
  updateNavUI();
  showToast('👑 ¡Bienvenido Super Administrador Luis Uzcátegui!', 'success');

  if (redirectUrl) {
    setTimeout(() => { window.location.href = redirectUrl; }, 350);
  }
  return true;
}

// ── Estado global inicializado optimistamente desde localStorage ──
const _rawAdmin = typeof localStorage !== 'undefined' && (localStorage.getItem(LOCAL_ADMIN_KEY) === '1' || localStorage.getItem('ives_local_admin') === '1' || localStorage.getItem(ROLE_KEY) === 'admin');
const _rawCedula = typeof localStorage !== 'undefined' ? (localStorage.getItem('infovzla_user_cedula') || null) : null;
const _isSuperLocal = _rawAdmin || isSuperAdminIdentifier(_rawCedula);

const _initAdmin  = _isSuperLocal;
const _initRole   = _isSuperLocal ? 'admin' : (typeof localStorage !== 'undefined' ? (localStorage.getItem(ROLE_KEY) || localStorage.getItem('ives_user_role') || null) : null);
const _initCedula = _isSuperLocal ? 'V-12832779' : _rawCedula;
const _initWA     = _isSuperLocal ? '04242964339' : (typeof localStorage !== 'undefined' ? (localStorage.getItem(WA_KEY) || localStorage.getItem('ives_wa_number') || null) : null);
const _initNombre = _isSuperLocal ? 'Luis Uzcátegui' : (typeof localStorage !== 'undefined' ? (localStorage.getItem('infovzla_user_nombre') || null) : null);
const _initFoto   = typeof localStorage !== 'undefined' ? (localStorage.getItem('infovzla_user_foto') || null) : null;

let _initCliData = null;
try {
  const rawCli = typeof localStorage !== 'undefined' ? localStorage.getItem('infovzla_cliente_data') : null;
  if (rawCli) _initCliData = JSON.parse(rawCli);
} catch(_) {}
if (!_initCliData && (_initCedula || _initWA) && _initRole !== 'tecnico' && !_initAdmin) {
  _initCliData = {
    cedula: _initCedula,
    whatsapp: _initWA,
    nombre: _initNombre || 'Solicitante',
    fotoPerfil: _initFoto
  };
}

let _initTecData = null;
try {
  const rawTec = typeof localStorage !== 'undefined' ? localStorage.getItem('infovzla_tecnico_data') : null;
  if (rawTec) _initTecData = JSON.parse(rawTec);
} catch(_) {}
if (_isSuperLocal && !_initTecData) {
  _initTecData = { ...SUPER_ADMIN_DATA };
} else if (!_initTecData && (_initCedula || _initWA) && _initRole === 'tecnico') {
  _initTecData = {
    cedula: _initCedula,
    whatsapp: _initWA,
    nombre: _initNombre || 'Técnico IT',
    fotoPerfil: _initFoto
  };
}

export let isAdmin      = _initAdmin;
export let isTecnico    = _isSuperLocal || _initRole === 'tecnico';
export let userRol      = _initAdmin ? 'admin' : _initRole;
export let userWhatsApp = _initWA;
export let userNombre   = _initAdmin ? 'Luis Uzcátegui' : _initNombre;
export let userCedula   = _initAdmin ? 'V-12832779' : _initCedula;
export let userFoto     = _initFoto;
export let clienteData  = _initCliData;
export let tecnicoData  = _initTecData;
export let currentUser  = (_initAdmin || _initCedula || _initWA || _initRole)
  ? { uid: _initAdmin ? '12832779' : (_initCedula || _initWA || 'user'), displayName: userNombre || (_initRole === 'tecnico' ? 'Técnico IT' : 'Solicitante'), email: _initAdmin ? ADMIN_EMAIL : '' }
  : null;

// ── Callbacks registrados ────────────────────────────────────
const authListeners = [];
let _authResolved = !!currentUser;

export function onAuthChange(fn) {
  authListeners.push(fn);
  if (_authResolved || currentUser) {
    try { fn(currentUser, isAdmin, isTecnico, userRol); } catch(e) { console.error(e); }
  }
}

function notifyListeners() {
  _authResolved = true;
  authListeners.forEach(fn => { try { fn(currentUser, isAdmin, isTecnico, userRol); } catch(e) { console.error(e); } });
}

// ── Auth Modal Custom Multi-Rol ──────────────────────────────
export function openAuthModal(defaultTab = 'solicitante', initialMode = 'login', lockRole = false) {
  let modal = document.getElementById('modal-auth-custom');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-auth-custom';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'position:fixed !important; inset:0 !important; background:rgba(0,0,0,0.85) !important; backdrop-filter:blur(8px) !important; -webkit-backdrop-filter:blur(8px) !important; z-index:999999 !important; display:none; align-items:center !important; justify-content:center !important; padding:1rem !important; opacity:0; pointer-events:none; transition:opacity 0.25s ease;';
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 520px; max-height: 90vh; overflow-y: auto; padding: 2rem 1.75rem; position: relative; border: 1px solid rgba(99,179,237,0.25);">
        <button id="auth-close" style="position:absolute; right:15px; top:15px; background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
        
        <!-- Selector de Rol (visible solo si lockRole es falso) -->
        <div id="auth-role-tabs-container" class="auth-role-tabs" style="display:flex; gap:0.5rem; background:rgba(0,0,0,0.35); padding:4px; border-radius:12px; margin-bottom:0.75rem;">
          <button type="button" id="tab-rol-solicitante" class="btn btn-sm w-full" style="background:var(--blue); color:white; border-radius:8px; font-weight:700; font-size:0.85rem; transition:all 0.2s;">👤 Solicitante</button>
          <button type="button" id="tab-rol-tecnico" class="btn btn-sm w-full" style="background:transparent; color:var(--text-muted); border-radius:8px; font-weight:700; font-size:0.85rem; transition:all 0.2s;">⚡ Soy Técnico</button>
        </div>

        <!-- Selector de Modo: Login vs Registro -->
        <div class="auth-mode-tabs" style="display:flex; gap:0.35rem; background:rgba(255,255,255,0.05); padding:3px; border-radius:10px; margin-bottom:1.25rem;">
          <button type="button" id="tab-mode-login" class="btn btn-sm w-full" style="background:rgba(99,179,237,0.2); color:var(--text); border-radius:8px; font-weight:600; font-size:0.8rem; transition:all 0.2s;">🔑 Iniciar Sesión</button>
          <button type="button" id="tab-mode-register" class="btn btn-sm w-full" style="background:transparent; color:var(--text-muted); border-radius:8px; font-weight:600; font-size:0.8rem; transition:all 0.2s;">📝 Registrarme</button>
        </div>

        <h3 id="auth-modal-title" style="margin-bottom:0.35rem; text-align:center; font-size:1.25rem; font-weight:800;">Iniciar Sesión</h3>
        <p id="auth-modal-desc" style="text-align:center; color:var(--text-muted); font-size:0.82rem; margin-bottom:1.25rem;">Ingresa tus credenciales para acceder al sistema.</p>
        
        <!-- Campo Identificador para Login (Cédula o WhatsApp) -->
        <div id="auth-login-identifier-group" class="form-group" style="margin-bottom:1rem;">
          <label id="auth-wa-label" class="form-label">Cédula (Usuario) o WhatsApp</label>
          <input type="text" id="auth-wa" class="form-input" placeholder="Ej: V-12345678 o 04121234567" maxlength="25">
        </div>

        <!-- ── Campos de Registro para Solicitante (TODOS OBLIGATORIOS) ── -->
        <div id="auth-register-fields" style="display:none; margin-bottom:1.25rem; background:rgba(99,179,237,0.06); padding:1.1rem; border-radius:10px; border:1px dashed rgba(99,179,237,0.3);">
          <p style="color:var(--accent); font-size:0.84rem; margin-bottom:0.85rem; text-align:center; font-weight:800;">
            👤 Registro de Solicitante <br><span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(Todos los requisitos son obligatorios)</span>
          </p>
          
          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">1. Foto de su persona (JPG o PNG) *</label>
            <div style="display:flex; align-items:center; gap:0.75rem; background:rgba(0,0,0,0.25); padding:0.6rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
              <div id="auth-foto-preview-box" style="width:52px; height:52px; border-radius:50%; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; overflow:hidden; border:2px solid var(--blue); flex-shrink:0;">
                <img id="auth-foto-preview" src="" alt="Foto Solicitante" style="display:none; width:100%; height:100%; object-fit:cover;">
                <span id="auth-foto-placeholder" style="font-size:1.5rem;">📷</span>
              </div>
              <div style="flex:1;">
                <input type="file" id="auth-foto-file" accept="image/jpeg,image/png,image/jpg" style="display:none;">
                <button type="button" id="auth-btn-upload-foto" class="btn btn-sm" style="background:rgba(99,179,237,0.2); color:var(--text); border:1px solid rgba(99,179,237,0.4); font-size:0.78rem;">📁 Seleccionar Foto</button>
                <span id="auth-foto-name" style="display:block; font-size:0.72rem; color:var(--text-muted); margin-top:3px; word-break:break-all;">Ningún archivo seleccionado</span>
              </div>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">2. Nombre y Apellido *</label>
            <input type="text" id="auth-nombre" class="form-input" placeholder="Ej: María González" required>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">3. Compañía / Empresa *</label>
            <input type="text" id="auth-compania" class="form-input" placeholder="Ej: Corporación Andina C.A. / Particular" required>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">4. Dirección de la Compañía o Local *</label>
            <textarea id="auth-dir-compania" class="form-input" rows="2" placeholder="Ej: Av. Principal, Torre Norte, Piso 4, Ofic. 4B" required style="resize:vertical; min-height:50px;"></textarea>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
            <div>
              <label class="form-label">5. Cédula (Tu Usuario) *</label>
              <input type="text" id="auth-cedula" class="form-input" placeholder="V-12345678" required>
            </div>
            <div>
              <label class="form-label">6. WhatsApp / Teléfono *</label>
              <input type="tel" id="auth-wa-solicitante" class="form-input" placeholder="04121234567" maxlength="15" required>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">7. Correo Electrónico *</label>
            <input type="email" id="auth-email-solicitante" class="form-input" placeholder="correo@ejemplo.com" required>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">8. Descripción de su Profesión / Cargo *</label>
            <input type="text" id="auth-profesion-solicitante" class="form-input" placeholder="Ej: Gerente de Operaciones / Encargado de Local" required>
          </div>

          <div class="form-group" style="margin-bottom:0.35rem;">
            <label class="form-label">9. Dirección de donde se hará el trabajo *</label>
            <textarea id="auth-dir-trabajo" class="form-input" rows="2" placeholder="Dirección del servicio (o indicar 'Misma sede de la compañía')" required style="resize:vertical; min-height:50px;"></textarea>
          </div>
        </div>

        <!-- ── Campos de Registro para Técnico (TODOS OBLIGATORIOS) ── -->
        <div id="auth-tecnico-fields" style="display:none; margin-bottom:1.25rem; background:rgba(246,173,85,0.08); padding:1.1rem; border-radius:10px; border:1px dashed rgba(246,173,85,0.3);">
          <p style="color:#f6ad55; font-size:0.84rem; margin-bottom:0.85rem; text-align:center; font-weight:800;">
            🛠️ Registro Profesional — Red de Técnicos IT <br><span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(Todos los requisitos son obligatorios)</span>
          </p>
          
          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">1. Foto de su persona (JPG o PNG) *</label>
            <div style="display:flex; align-items:center; gap:0.75rem; background:rgba(0,0,0,0.25); padding:0.6rem; border-radius:8px; border:1px solid rgba(246,173,85,0.2);">
              <div id="tec-foto-preview-box" style="width:52px; height:52px; border-radius:50%; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; overflow:hidden; border:2px solid #f6ad55; flex-shrink:0;">
                <img id="tec-foto-preview" src="" alt="Foto Técnico" style="display:none; width:100%; height:100%; object-fit:cover;">
                <span id="tec-foto-placeholder" style="font-size:1.5rem;">👨‍🔧</span>
              </div>
              <div style="flex:1;">
                <input type="file" id="tec-foto-file" accept="image/jpeg,image/png,image/jpg" style="display:none;">
                <button type="button" id="tec-btn-upload-foto" class="btn btn-sm" style="background:rgba(246,173,85,0.2); color:#f6ad55; border:1px solid rgba(246,173,85,0.4); font-size:0.78rem;">📁 Seleccionar Foto</button>
                <span id="tec-foto-name" style="display:block; font-size:0.72rem; color:var(--text-muted); margin-top:3px; word-break:break-all;">Ningún archivo seleccionado</span>
              </div>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">2. Nombre Completo *</label>
            <input type="text" id="tec-nombre" class="form-input" placeholder="Ej: Luis Rodríguez" required>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
            <div>
              <label class="form-label">3. Cédula / Doc. (Usuario) *</label>
              <input type="text" id="tec-cedula" class="form-input" placeholder="V-12345678" required>
            </div>
            <div>
              <label class="form-label">4. WhatsApp / Teléfono *</label>
              <input type="tel" id="tec-wa" class="form-input" placeholder="04121234567" maxlength="15" required>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
            <div>
              <label class="form-label">5. Años de Experiencia *</label>
              <input type="number" id="tec-exp" class="form-input" placeholder="Ej: 5" min="0" required>
            </div>
            <div>
              <label class="form-label">6. Zona de Cobertura *</label>
              <input type="text" id="tec-zona" class="form-input" placeholder="Ej: Caracas Este, Chacao, Guarenas" required>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">7. Correo Electrónico *</label>
            <input type="email" id="tec-email" class="form-input" placeholder="tecnico@ejemplo.com" required>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label">8. Descripción de su Profesión / Perfil *</label>
            <textarea id="tec-profesion" class="form-input" rows="2" placeholder="Ej: Técnico Superior en Sistemas con 8 años de experiencia en soporte a servidores, CCTV y redes" required style="resize:vertical; min-height:50px;"></textarea>
          </div>

          <div class="form-group" style="margin-bottom:0.65rem;">
            <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
              <span>9. Especialidades Técnicas & Cualidades (Renglón por renglón) *</span>
              <button type="button" id="tec-btn-add-cualidad" class="btn btn-sm" style="background:rgba(246,173,85,0.25); color:#f6ad55; border:1px solid rgba(246,173,85,0.4); font-size:0.75rem; padding:2px 8px; border-radius:6px; cursor:pointer;">➕ Agregar Renglón</button>
            </label>
            <div id="tec-cualidades-list" style="display:flex; flex-direction:column; gap:0.45rem; margin-top:0.35rem;">
              <div class="cualidad-row" style="display:flex; gap:0.4rem; align-items:center;">
                <select class="form-input tec-cualidad-icon" style="width:62px; padding:0.45rem 0.2rem; font-size:1.1rem; text-align:center; background:#1a202c; border:1px solid rgba(246,173,85,0.4); border-radius:6px; cursor:pointer;" title="Selecciona el icono de la especialidad">
                  <option value="💻" selected>💻</option>
                  <option value="📡">📡</option>
                  <option value="📹">📹</option>
                  <option value="🐧">🐧</option>
                  <option value="🖨️">🖨️</option>
                  <option value="🌐">🌐</option>
                  <option value="⚡">⚡</option>
                  <option value="🔧">🔧</option>
                  <option value="📱">📱</option>
                  <option value="🔒">🔒</option>
                  <option value="💾">💾</option>
                  <option value="🛡️">🛡️</option>
                  <option value="🛠️">🛠️</option>
                  <option value="🔌">🔌</option>
                  <option value="🖥️">🖥️</option>
                  <option value="⚙️">⚙️</option>
                </select>
                <input type="text" class="form-input tec-cualidad-input" placeholder="Renglón 1: Escribe tu especialidad técnica (ej: Reparación PC) y presiona Enter o ✓" style="font-size:0.83rem; padding:0.5rem; flex:1;" value="" required>
                <button type="button" class="btn-check-cualidad" style="background:#28a745; color:white; border:none; width:34px; height:34px; border-radius:6px; cursor:pointer; font-weight:800; font-size:1rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s;" title="Aceptar y pasar a la siguiente especialidad (Enter)">✓</button>
                <button type="button" class="btn-remove-cualidad" style="background:none; border:none; color:#fc8181; font-size:1.2rem; cursor:pointer; padding:0 4px;" title="Eliminar renglón">&times;</button>
              </div>
            </div>

            <!-- Iconos & Categorías Activas en Tiempo Real -->
            <div style="margin-top:0.75rem; background:rgba(0,0,0,0.3); border:1px solid rgba(246,173,85,0.25); border-radius:8px; padding:0.65rem;">
              <div style="font-size:0.75rem; font-weight:700; color:#f6ad55; margin-bottom:0.4rem; display:flex; align-items:center; justify-content:space-between;">
                <span>⚡ Categorías & Iconos Activos en tu Perfil:</span>
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">(Se activan automáticamente)</span>
              </div>
              <div id="tec-active-badges" style="display:flex; flex-wrap:wrap; gap:0.4rem; min-height:28px;">
                <!-- Badges renderizados dinámicamente -->
              </div>
            </div>

            <small style="color:var(--text-muted); font-size:0.72rem; display:block; margin-top:4px;">Escribe cada especialidad y presiona <strong>Enter</strong> o el botón <strong>✓</strong> para aceptarla y pasar al siguiente renglón.</small>
          </div>
        </div>
        
        <!-- Campo Contraseña -->
        <div class="form-group" style="position:relative; margin-bottom:0.5rem;">
          <label class="form-label">Contraseña *</label>
          <input type="password" id="auth-pass" class="form-input" placeholder="Tu contraseña segura">
          <button type="button" id="auth-toggle-pass" style="position:absolute; right:10px; top:36px; background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer;">👁️</button>
        </div>
        
        <!-- Indicadores de Validación de Contraseña -->
        <div class="auth-dots" style="display:flex; flex-direction:column; gap:0.35rem; margin-bottom:1.25rem; font-size:0.75rem; color:var(--text-dim);">
          <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-letters" style="width:8px;height:8px;border-radius:50%;background:var(--red);transition:background 0.3s;"></div> Obligatorio: Mínimo 6 letras (a-z, A-Z)</div>
          <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-numbers" style="width:8px;height:8px;border-radius:50%;background:var(--red);transition:background 0.3s;"></div> Obligatorio: Mínimo 4 números (0-9)</div>
        </div>
        
        <button id="auth-btn-submit" class="btn btn-primary w-full" style="margin-bottom:0.75rem; font-weight:700; padding:0.85rem; font-size:0.95rem; cursor:pointer;">Ingresar</button>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; font-size:0.8rem;">
          <a id="auth-switch-mode-link" style="color:var(--text-muted); cursor:pointer; text-decoration:underline;">¿No tienes cuenta? Regístrate</a>
          <a id="auth-forgot-pass" style="color:var(--blue); cursor:pointer; text-decoration:underline;">¿Olvidaste tu clave?</a>
        </div>
        
        <div id="auth-forgot-panel" style="display:none; background:rgba(99,179,237,0.1); border:1px solid var(--blue); padding:1rem; border-radius:8px; margin-top:1rem; text-align:center;">
          <p style="font-size:0.82rem; color:var(--text); margin-bottom:0.75rem;">Se abrirá WhatsApp para solicitar a Soporte el reinicio de tu clave.</p>
          <button id="auth-btn-recover" class="btn btn-sm" style="background:#25D366; color:white; border:none; width:100%;">💬 Recuperar por WhatsApp</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Variables internas
    let selectedRole = defaultTab || 'solicitante';
    let currentMode  = initialMode || 'login'; // 'login' | 'registro'
    let isRoleLocked = lockRole;
    let uploadedSolicitanteFotoBase64 = null;
    let uploadedTecnicoFotoBase64 = null;

    const roleTabsContainer = document.getElementById('auth-role-tabs-container');
    const tabSolicitante = document.getElementById('tab-rol-solicitante');
    const tabTecnico     = document.getElementById('tab-rol-tecnico');
    const tabLogin       = document.getElementById('tab-mode-login');
    const tabRegister    = document.getElementById('tab-mode-register');
    const switchModeLink = document.getElementById('auth-switch-mode-link');
    const modalTitle     = document.getElementById('auth-modal-title');
    const modalDesc      = document.getElementById('auth-modal-desc');
    const loginIdentGroup = document.getElementById('auth-login-identifier-group');
    const waLabel        = document.getElementById('auth-wa-label');
    const passInput      = document.getElementById('auth-pass');
    const waInput        = document.getElementById('auth-wa');
    const toggleBtn      = document.getElementById('auth-toggle-pass');
    const submitBtn      = document.getElementById('auth-btn-submit');
    const closeBtn       = document.getElementById('auth-close');
    const dotLetters     = document.getElementById('dot-letters');
    const dotNumbers     = document.getElementById('dot-numbers');
    const forgotPassLink = document.getElementById('auth-forgot-pass');
    const forgotPanel    = document.getElementById('auth-forgot-panel');
    const recoverBtn     = document.getElementById('auth-btn-recover');

    // Manejo de carga de foto para solicitante
    const fotoFileInput  = document.getElementById('auth-foto-file');
    const fotoUploadBtn  = document.getElementById('auth-btn-upload-foto');
    const fotoPreviewImg = document.getElementById('auth-foto-preview');
    const fotoPlaceholder = document.getElementById('auth-foto-placeholder');
    const fotoNameSpan   = document.getElementById('auth-foto-name');

    fotoUploadBtn?.addEventListener('click', () => fotoFileInput?.click());

    fotoFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        uploadedSolicitanteFotoBase64 = await processImageFile(file);
        if (fotoPreviewImg) {
          fotoPreviewImg.src = uploadedSolicitanteFotoBase64;
          fotoPreviewImg.style.display = 'block';
        }
        if (fotoPlaceholder) fotoPlaceholder.style.display = 'none';
        if (fotoNameSpan) fotoNameSpan.textContent = file.name;
        revalidatePassword();
      } catch (err) {
        showToast(err.message || 'Error al procesar la foto', 'error');
        fotoFileInput.value = '';
      }
    });

    // Manejo de carga de foto para técnico
    const tecFotoFileInput   = document.getElementById('tec-foto-file');
    const tecFotoUploadBtn   = document.getElementById('tec-btn-upload-foto');
    const tecFotoPreviewImg  = document.getElementById('tec-foto-preview');
    const tecFotoPlaceholder = document.getElementById('tec-foto-placeholder');
    const tecFotoNameSpan    = document.getElementById('tec-foto-name');

    tecFotoUploadBtn?.addEventListener('click', () => tecFotoFileInput?.click());

    tecFotoFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        uploadedTecnicoFotoBase64 = await processImageFile(file);
        if (tecFotoPreviewImg) {
          tecFotoPreviewImg.src = uploadedTecnicoFotoBase64;
          tecFotoPreviewImg.style.display = 'block';
        }
        if (tecFotoPlaceholder) tecFotoPlaceholder.style.display = 'none';
        if (tecFotoNameSpan) tecFotoNameSpan.textContent = file.name;
        revalidatePassword();
      } catch (err) {
        showToast(err.message || 'Error al procesar la foto', 'error');
        tecFotoFileInput.value = '';
      }
    });

    // Manejo dinámico de Renglones de Cualidades & Iconos para Técnico
    const btnAddCualidad = document.getElementById('tec-btn-add-cualidad');
    const cualidadesList = document.getElementById('tec-cualidades-list');
    const badgesContainer = document.getElementById('tec-active-badges');

    const ICONS_OPTIONS = `
      <option value="💻">💻 PC & Laptops (Windows)</option>
      <option value="🍏">🍏 Apple & macOS (MacBook, iMac)</option>
      <option value="📡">📡 Redes WiFi, Routers & Switching</option>
      <option value="📹">📹 CCTV, Cámaras & NVR/DVR</option>
      <option value="🐧">🐧 Linux & Servidores OpenSource</option>
      <option value="🖥️">🖥️ Windows Server & Active Directory</option>
      <option value="☁️">☁️ Cloud, VPS & Hosting (AWS/Azure)</option>
      <option value="🛡️">🛡️ Ciberseguridad, Firewalls & VPN</option>
      <option value="🔌">🔌 Cableado Estructurado & Fibra</option>
      <option value="🖨️">🖨️ Impresoras, Escáneres & Hardware</option>
      <option value="⚡">⚡ Energía, UPS & Inversores</option>
      <option value="💾">💾 Backup, Respaldo & Recuperación</option>
      <option value="🌐">🌐 Desarrollo Web & Tiendas Online</option>
      <option value="⚙️">⚙️ Desarrollo de Software & APIs</option>
      <option value="🗄️">🗄️ Bases de Datos (SQL/NoSQL)</option>
      <option value="📱">📱 Celulares, Móvil, Android & iOS</option>
      <option value="📦">📦 Virtualización (VMware, Proxmox, Docker)</option>
      <option value="🔒">🔒 Antivirus, Seguridad & Malware</option>
      <option value="📞">📞 Telefonía IP, PBX & VoIP</option>
      <option value="🔧">🔧 Mantenimiento & Limpieza Física</option>
      <option value="🤖">🤖 Inteligencia Artificial & Bots</option>
      <option value="💳">💳 Sistemas POS & Facturación</option>
      <option value="🎮">🎮 PC Gaming & Estaciones de Trabajo</option>
      <option value="🛠️">🛠️ Soporte Técnico General / Help Desk</option>
    `;

    function detectIconForText(text) {
      const lower = text.toLowerCase();
      if (lower.includes('mac') || lower.includes('apple') || lower.includes('macos') || lower.includes('imac') || lower.includes('osx')) return '🍏';
      if (lower.includes('wifi') || lower.includes('red') || lower.includes('router') || lower.includes('switch') || lower.includes('internet') || lower.includes('mikrotik') || lower.includes('lan') || lower.includes('wan') || lower.includes('vlan')) return '📡';
      if (lower.includes('camara') || lower.includes('cctv') || lower.includes('dvr') || lower.includes('nvr') || lower.includes('seguridad') || lower.includes('vigilancia') || lower.includes('hikvision') || lower.includes('dahua')) return '📹';
      if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') || lower.includes('centos') || lower.includes('redhat') || lower.includes('server') || lower.includes('servidor')) return '🐧';
      if (lower.includes('windows server') || lower.includes('active directory') || lower.includes('directorio activo') || lower.includes('dominio') || lower.includes('rdp') || lower.includes('iis')) return '🖥️';
      if (lower.includes('cloud') || lower.includes('nube') || lower.includes('aws') || lower.includes('azure') || lower.includes('vps') || lower.includes('hosting') || lower.includes('gcp')) return '☁️';
      if (lower.includes('firewall') || lower.includes('ciberseguridad') || lower.includes('vpn') || lower.includes('pfsense') || lower.includes('fortinet')) return '🛡️';
      if (lower.includes('cableado') || lower.includes('utp') || lower.includes('fibra') || lower.includes('rack') || lower.includes('patch panel') || lower.includes('canaletas')) return '🔌';
      if (lower.includes('impresora') || lower.includes('toner') || lower.includes('escaner') || lower.includes('plotter') || lower.includes('epson') || lower.includes('hp')) return '🖨️';
      if (lower.includes('pc') || lower.includes('laptop') || lower.includes('computadora') || lower.includes('windows') || lower.includes('formateo') || lower.includes('portatil')) return '💻';
      if (lower.includes('ups') || lower.includes('electric') || lower.includes('inversor') || lower.includes('voltaje') || lower.includes('energia') || lower.includes('regulador') || lower.includes('bateria')) return '⚡';
      if (lower.includes('disco') || lower.includes('backup') || lower.includes('respaldo') || lower.includes('recuperacion') || lower.includes('raid') || lower.includes('hdd') || lower.includes('ssd')) return '💾';
      if (lower.includes('web') || lower.includes('pagina') || lower.includes('tienda') || lower.includes('ecommerce') || lower.includes('wordpress') || lower.includes('frontend')) return '🌐';
      if (lower.includes('software') || lower.includes('sistema') || lower.includes('api') || lower.includes('programa') || lower.includes('python') || lower.includes('javascript') || lower.includes('backend') || lower.includes('node')) return '⚙️';
      if (lower.includes('sql') || lower.includes('mysql') || lower.includes('postgresql') || lower.includes('base de datos') || lower.includes('database') || lower.includes('oracle')) return '🗄️';
      if (lower.includes('celular') || lower.includes('telefono') || lower.includes('movil') || lower.includes('android') || lower.includes('ios') || lower.includes('tablet') || lower.includes('ipad')) return '📱';
      if (lower.includes('virtualizacion') || lower.includes('vmware') || lower.includes('proxmox') || lower.includes('docker') || lower.includes('hyper-v') || lower.includes('contenedor')) return '📦';
      if (lower.includes('antivirus') || lower.includes('virus') || lower.includes('malware') || lower.includes('bloqueo') || lower.includes('troyano') || lower.includes('spyware')) return '🔒';
      if (lower.includes('voip') || lower.includes('asterisk') || lower.includes('pbx') || lower.includes('telefonia') || lower.includes('central telefonica') || lower.includes('sip')) return '📞';
      if (lower.includes('mantenimiento') || lower.includes('limpieza') || lower.includes('pasta termica') || lower.includes('reparac') || lower.includes('ensamblaje')) return '🔧';
      if (lower.includes('ia') || lower.includes('ai') || lower.includes('bot') || lower.includes('automatizacion') || lower.includes('chatbot') || lower.includes('gpt')) return '🤖';
      if (lower.includes('pos') || lower.includes('punto de venta') || lower.includes('facturacion') || lower.includes('caja') || lower.includes('fiscal') || lower.includes('valery') || lower.includes('saint')) return '💳';
      if (lower.includes('gaming') || lower.includes('gamer') || lower.includes('workstation') || lower.includes('gpu') || lower.includes('tarjeta grafica')) return '🎮';
      return null;
    }

    function updateActiveBadges() {
      if (!badgesContainer || !cualidadesList) return;
      const rows = cualidadesList.querySelectorAll('.cualidad-row');
      const badges = [];
      rows.forEach(row => {
        const icon = row.querySelector('.tec-cualidad-icon')?.value || '🛠️';
        const text = row.querySelector('.tec-cualidad-input')?.value.trim();
        if (text) {
          badges.push({ icon, text });
        }
      });

      if (badges.length === 0) {
        badgesContainer.innerHTML = `<span style="font-size:0.75rem; color:var(--text-dim); font-style:italic;">Escribe tus especialidades arriba y presiona Enter o ✓ para agregarlas.</span>`;
      } else {
        badgesContainer.innerHTML = badges.map(b => `
          <span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(246,173,85,0.18); border:1px solid rgba(246,173,85,0.45); color:#fbd38d; padding:0.25rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:700;">
            <span style="font-size:0.95rem;">${b.icon}</span> ${b.text.length > 25 ? b.text.substring(0, 25) + '...' : b.text}
          </span>
        `).join('');
      }
    }

    function addNewCualidadRow(initialIcon = '💻', initialText = '') {
      if (!cualidadesList) return null;
      const rowCount = cualidadesList.querySelectorAll('.cualidad-row').length + 1;
      const row = document.createElement('div');
      row.className = 'cualidad-row';
      row.style.cssText = 'display:flex; gap:0.4rem; align-items:center;';
      row.innerHTML = `
        <select class="form-input tec-cualidad-icon" style="width:62px; padding:0.45rem 0.2rem; font-size:1.1rem; text-align:center; background:#1a202c; border:1px solid rgba(246,173,85,0.4); border-radius:6px; cursor:pointer;" title="Selecciona el icono de la especialidad">
          ${ICONS_OPTIONS}
        </select>
        <input type="text" class="form-input tec-cualidad-input" placeholder="Renglón ${rowCount}: Escribe tu especialidad técnica..." style="font-size:0.83rem; padding:0.5rem; flex:1;" value="${initialText}">
        <button type="button" class="btn-check-cualidad" style="background:#28a745; color:white; border:none; width:34px; height:34px; border-radius:6px; cursor:pointer; font-weight:800; font-size:1rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s;" title="Aceptar y pasar a la siguiente especialidad (Enter)">✓</button>
        <button type="button" class="btn-remove-cualidad" style="background:none; border:none; color:#fc8181; font-size:1.2rem; cursor:pointer; padding:0 4px;" title="Eliminar renglón">&times;</button>
      `;
      if (initialIcon) {
        const sel = row.querySelector('.tec-cualidad-icon');
        if (sel) sel.value = initialIcon;
      }
      cualidadesList.appendChild(row);
      bindRowEvents(row);
      updateActiveBadges();
      return row;
    }

    function bindRowEvents(row) {
      const input = row.querySelector('.tec-cualidad-input');
      const iconSelect = row.querySelector('.tec-cualidad-icon');
      const checkBtn = row.querySelector('.btn-check-cualidad');
      
      input?.addEventListener('input', () => {
        if (!row.dataset.iconManual) {
          const autoIcon = detectIconForText(input.value);
          if (autoIcon && iconSelect) {
            iconSelect.value = autoIcon;
          }
        }
        updateActiveBadges();
      });

      iconSelect?.addEventListener('change', () => {
        row.dataset.iconManual = '1';
        updateActiveBadges();
      });

      function acceptAndNext() {
        const val = input?.value.trim();
        if (val) {
          // Animación de confirmación en el botón check
          if (checkBtn) {
            checkBtn.style.background = '#38a169';
            checkBtn.style.transform = 'scale(1.1)';
            setTimeout(() => {
              if (checkBtn) {
                checkBtn.style.background = '#28a745';
                checkBtn.style.transform = 'scale(1)';
              }
            }, 180);
          }
          updateActiveBadges();

          // Buscar si ya existe un renglón posterior vacío
          const allRows = Array.from(cualidadesList.querySelectorAll('.cualidad-row'));
          const currIdx = allRows.indexOf(row);
          let nextEmpty = null;
          for (let i = currIdx + 1; i < allRows.length; i++) {
            const inp = allRows[i].querySelector('.tec-cualidad-input');
            if (inp && !inp.value.trim()) {
              nextEmpty = allRows[i];
              break;
            }
          }

          if (nextEmpty) {
            nextEmpty.querySelector('.tec-cualidad-input')?.focus();
          } else {
            const newRow = addNewCualidadRow();
            newRow?.querySelector('.tec-cualidad-input')?.focus();
          }
        } else {
          input?.focus();
        }
      }

      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          acceptAndNext();
        }
      });

      checkBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        acceptAndNext();
      });
    }

    // Bind existing rows and ensure full 24 category options
    cualidadesList?.querySelectorAll('.cualidad-row').forEach(row => {
      const select = row.querySelector('.tec-cualidad-icon');
      if (select) {
        const val = select.value;
        select.innerHTML = ICONS_OPTIONS;
        select.value = val;
      }
      bindRowEvents(row);
    });
    updateActiveBadges();

    btnAddCualidad?.addEventListener('click', () => {
      const newRow = addNewCualidadRow();
      newRow?.querySelector('.tec-cualidad-input')?.focus();
    });

    cualidadesList?.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-cualidad')) {
        const allRows = cualidadesList.querySelectorAll('.cualidad-row');
        if (allRows.length > 1) {
          e.target.closest('.cualidad-row')?.remove();
        } else {
          const input = allRows[0].querySelector('.tec-cualidad-input');
          if (input) input.value = '';
        }
        updateActiveBadges();
      }
    });

    function updateUI() {
      // Mostrar u ocultar selector de rol
      if (roleTabsContainer) {
        roleTabsContainer.style.display = isRoleLocked ? 'none' : 'flex';
      }

      // 1. Estilos Role Tabs
      if (selectedRole === 'tecnico') {
        tabTecnico.style.background = '#f6ad55';
        tabTecnico.style.color = '#1a202c';
        tabSolicitante.style.background = 'transparent';
        tabSolicitante.style.color = 'var(--text-muted)';
      } else {
        tabSolicitante.style.background = 'var(--blue)';
        tabSolicitante.style.color = 'white';
        tabTecnico.style.background = 'transparent';
        tabTecnico.style.color = 'var(--text-muted)';
      }

      // 2. Estilos Mode Tabs & Form Visibility
      const isReg = currentMode === 'registro';
      if (isReg) {
        tabRegister.style.background = selectedRole === 'tecnico' ? '#f6ad55' : 'var(--blue)';
        tabRegister.style.color = selectedRole === 'tecnico' ? '#1a202c' : 'white';
        tabLogin.style.background = 'transparent';
        tabLogin.style.color = 'var(--text-muted)';

        loginIdentGroup.style.display = 'none'; // El registro usa sus propios campos dedicados

        if (selectedRole === 'tecnico') {
          modalTitle.textContent = 'Registro de Técnico IT';
          modalDesc.textContent = 'Completa todos los requisitos obligatorios para crear tu cuenta.';
          document.getElementById('auth-tecnico-fields').style.display = 'block';
          document.getElementById('auth-register-fields').style.display = 'none';
          submitBtn.textContent = '🛠️ Crear Cuenta de Técnico';
          submitBtn.style.background = '#f6ad55';
          submitBtn.style.color = '#1a202c';
        } else {
          modalTitle.textContent = 'Registro de Solicitante';
          modalDesc.textContent = 'Completa todos los requisitos obligatorios para crear tu cuenta.';
          document.getElementById('auth-register-fields').style.display = 'block';
          document.getElementById('auth-tecnico-fields').style.display = 'none';
          submitBtn.textContent = '📝 Crear Cuenta de Solicitante';
          submitBtn.style.background = 'var(--blue)';
          submitBtn.style.color = 'white';
        }
        if (switchModeLink) switchModeLink.textContent = '¿Ya tienes cuenta? Inicia sesión aquí';
      } else {
        tabLogin.style.background = selectedRole === 'tecnico' ? 'rgba(246,173,85,0.25)' : 'rgba(99,179,237,0.25)';
        tabLogin.style.color = 'var(--text)';
        tabRegister.style.background = 'transparent';
        tabRegister.style.color = 'var(--text-muted)';

        loginIdentGroup.style.display = 'block';
        document.getElementById('auth-register-fields').style.display = 'none';
        document.getElementById('auth-tecnico-fields').style.display = 'none';

        if (selectedRole === 'tecnico') {
          modalTitle.textContent = 'Acceso de Técnicos IT';
          modalDesc.textContent = 'Ingresa con tu Cédula o WhatsApp y contraseña.';
          if (waLabel) waLabel.textContent = 'Cédula o WhatsApp';
          if (waInput) waInput.placeholder = 'Ej: V-12345678 o 04121234567';
          submitBtn.textContent = '🔑 Iniciar Sesión Técnico';
          submitBtn.style.background = '#f6ad55';
          submitBtn.style.color = '#1a202c';
        } else {
          modalTitle.textContent = 'Acceso de Solicitantes';
          modalDesc.textContent = 'Ingresa con tu Cédula (Usuario) o WhatsApp y contraseña.';
          if (waLabel) waLabel.textContent = 'Cédula (Usuario) o WhatsApp';
          if (waInput) waInput.placeholder = 'Ej: V-12345678 o 04121234567';
          submitBtn.textContent = '🔑 Iniciar Sesión';
          submitBtn.style.background = 'var(--blue)';
          submitBtn.style.color = 'white';
        }
        if (switchModeLink) switchModeLink.textContent = '¿No tienes cuenta? Regístrate aquí';
      }

      revalidatePassword();
    }

    tabSolicitante.addEventListener('click', () => { selectedRole = 'solicitante'; updateUI(); });
    tabTecnico.addEventListener('click',     () => { selectedRole = 'tecnico'; updateUI(); });
    tabLogin.addEventListener('click',       () => { currentMode = 'login'; updateUI(); });
    tabRegister.addEventListener('click',    () => { currentMode = 'registro'; updateUI(); });

    switchModeLink?.addEventListener('click', () => {
      currentMode = currentMode === 'login' ? 'registro' : 'login';
      updateUI();
    });

    // Guardar referencia en el elemento para llamadas posteriores
    modal._setTabAndMode = function(role, mode, lock) {
      selectedRole = role || 'solicitante';
      currentMode  = mode || 'login';
      isRoleLocked = (typeof lock === 'boolean') ? lock : (role !== null);
      updateUI();
    };

    forgotPassLink.addEventListener('click', () => {
      forgotPanel.style.display = forgotPanel.style.display === 'none' ? 'block' : 'none';
    });

    recoverBtn.addEventListener('click', () => {
      const wa = waInput.value.trim();
      if (!wa) {
        showToast('Ingresa tu Cédula o número de WhatsApp arriba primero.', 'error');
        return;
      }
      const adminWa = '584242964339';
      const text = `Hola Soporte Informáticos Venezuela, soy ${selectedRole === 'tecnico' ? 'el técnico' : 'el usuario'} con identificador ${wa} y solicito restablecer mi contraseña.`;
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
      const passRules = checkPasswordRules(val);

      dotLetters.style.background = passRules.hasLetters ? 'var(--green)' : 'var(--red)';
      dotNumbers.style.background = passRules.hasNumbers ? 'var(--green)' : 'var(--red)';
    }

    passInput.addEventListener('input', revalidatePassword);
    waInput.addEventListener('input', revalidatePassword);

    function closeModalAuth() {
      modal.classList.remove('open');
      modal.style.display = 'none';
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
    }

    closeBtn.addEventListener('click', closeModalAuth);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModalAuth();
    });

    submitBtn.addEventListener('click', async () => {
      const pass = passInput.value;
      const passRules = checkPasswordRules(pass);

      const isRegisteringSolicitante = currentMode === 'registro' && selectedRole === 'solicitante';
      const isRegisteringTecnico     = currentMode === 'registro' && selectedRole === 'tecnico';

      submitBtn.textContent = 'Procesando...';
      submitBtn.disabled = true;

      try {
        if (isRegisteringTecnico) {
          // ── REGISTRO DE TÉCNICO (TODOS LOS REQUISITOS OBLIGATORIOS)
          const nombre       = document.getElementById('tec-nombre')?.value.trim();
          const cedula       = document.getElementById('tec-cedula')?.value.trim();
          const wa           = document.getElementById('tec-wa')?.value.trim().replace(/[^0-9]/g, '');
          const exp          = document.getElementById('tec-exp')?.value.trim();
          const zona         = document.getElementById('tec-zona')?.value.trim();
          const emailInput   = document.getElementById('tec-email')?.value.trim();
          const profesion    = document.getElementById('tec-profesion')?.value.trim();

          const cualidadRows = document.querySelectorAll('#tec-cualidades-list .cualidad-row');
          const especialidades = [];
          const cualidades = [];

          cualidadRows.forEach(row => {
            const icon = row.querySelector('.tec-cualidad-icon')?.value || '🛠️';
            const text = row.querySelector('.tec-cualidad-input')?.value.trim();
            if (text) {
              especialidades.push(`${icon} ${text}`);
              cualidades.push(text);
            }
          });

          // Validaciones estrictas
          if (!uploadedTecnicoFotoBase64) {
            showToast('Subir la Foto de su persona (JPG o PNG) es obligatorio.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (!nombre) {
            showToast('El Nombre Completo es obligatorio.', 'error');
            document.getElementById('tec-nombre')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (!cedula) {
            showToast('La Cédula / Documento es obligatoria.', 'error');
            document.getElementById('tec-cedula')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (!wa || wa.length < 10) {
            showToast('El número de WhatsApp es obligatorio (mínimo 10 dígitos).', 'error');
            document.getElementById('tec-wa')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (!exp) {
            showToast('Los Años de Experiencia son obligatorios.', 'error');
            document.getElementById('tec-exp')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (!zona) {
            showToast('La Zona de Cobertura es obligatoria.', 'error');
            document.getElementById('tec-zona')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
            showToast('El Correo Electrónico es obligatorio y debe tener formato válido.', 'error');
            document.getElementById('tec-email')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (!profesion) {
            showToast('La Descripción de su Profesión / Perfil es obligatoria.', 'error');
            document.getElementById('tec-profesion')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (especialidades.length === 0) {
            showToast('Debes ingresar al menos una cualidad / especialidad técnica en los renglones.', 'error');
            document.querySelector('.tec-cualidad-input')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          if (!passRules.isValid) {
            showToast('La contraseña debe tener obligatoriamente al menos 6 letras y 4 números.', 'error');
            passInput.focus();
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }

          // Verificar si ya existe técnico con esa cédula o WhatsApp
          const yaExisteTecCed = await getTecnicoByCedula(cedula);
          if (yaExisteTecCed) {
            showToast('Esta cédula ya se encuentra registrada como técnico.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }
          const yaExisteTecWA = await getTecnicoByWA(wa);
          if (yaExisteTecWA) {
            showToast('Este número de WhatsApp ya se encuentra registrado como técnico.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = '🛠️ Crear Cuenta de Técnico'; return;
          }

          const hash = await sha256(pass);
          let userCred = null;
          try {
            userCred = await createUserWithEmailAndPassword(auth, emailInput, pass);
          } catch (authErr) {
            if (authErr.code === 'auth/email-already-in-use') {
              const fakeEmailCedula = `${cedula.replace(/[^a-zA-Z0-9]/g, '')}@informaticosvenezuela.com`;
              try {
                userCred = await createUserWithEmailAndPassword(auth, fakeEmailCedula, pass);
              } catch (_) {}
            }
          }

          const uid = userCred ? userCred.user.uid : `tec_${Date.now()}`;

          await guardarTecnico(uid, {
            uid: uid,
            nombre: nombre,
            cedula: cedula.toUpperCase(),
            cedulaNum: cedula.replace(/[^0-9]/g, ''),
            whatsapp: wa,
            email: emailInput,
            emailPersonal: emailInput,
            experiencia: exp,
            zona: zona,
            profesion: profesion,
            cualidades: cualidades,
            especialidades: especialidades,
            fotoPerfil: uploadedTecnicoFotoBase64,
            passwordHash: hash,
            rol: 'tecnico',
            estado: 'activo',
            disponible: true,
            creadoEn: serverTimestamp()
          });

          localStorage.setItem(ROLE_KEY, 'tecnico');
          localStorage.setItem(WA_KEY, wa);
          localStorage.setItem('infovzla_user_cedula', cedula.toUpperCase());
          localStorage.setItem('infovzla_user_nombre', nombre);
          try { localStorage.setItem('infovzla_user_foto', uploadedTecnicoFotoBase64); } catch(_) {}

          showToast('✅ ¡Cuenta de Técnico creada exitosamente!', 'success');
          modal.classList.remove('open');
          window.location.href = 'tecnico.html';
          return;

        } else if (isRegisteringSolicitante) {
          // ── REGISTRO DE SOLICITANTE (TODOS LOS REQUISITOS OBLIGATORIOS)
          const nombre       = document.getElementById('auth-nombre')?.value.trim();
          const compania     = document.getElementById('auth-compania')?.value.trim();
          const dirCompania  = document.getElementById('auth-dir-compania')?.value.trim();
          const cedula       = document.getElementById('auth-cedula')?.value.trim();
          const wa           = document.getElementById('auth-wa-solicitante')?.value.trim().replace(/[^0-9]/g, '');
          const emailInput   = document.getElementById('auth-email-solicitante')?.value.trim();
          const profesion    = document.getElementById('auth-profesion-solicitante')?.value.trim();
          const dirTrabajo   = document.getElementById('auth-dir-trabajo')?.value.trim();

          // Validaciones estrictas campo por campo
          if (!uploadedSolicitanteFotoBase64) {
            showToast('Subir la Foto de su persona (JPG o PNG) es obligatorio.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!nombre) {
            showToast('El Nombre y Apellido es obligatorio.', 'error');
            document.getElementById('auth-nombre')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!compania) {
            showToast('El nombre de la Compañía o Empresa es obligatorio.', 'error');
            document.getElementById('auth-compania')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!dirCompania) {
            showToast('La Dirección de la Compañía o Local es obligatoria.', 'error');
            document.getElementById('auth-dir-compania')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!cedula) {
            showToast('La Cédula (que será su usuario) es obligatoria.', 'error');
            document.getElementById('auth-cedula')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!wa || wa.length < 10) {
            showToast('El número de WhatsApp / Teléfono es obligatorio (mínimo 10 dígitos).', 'error');
            document.getElementById('auth-wa-solicitante')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
            showToast('El Correo Electrónico es obligatorio y debe tener formato válido.', 'error');
            document.getElementById('auth-email-solicitante')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!profesion) {
            showToast('La Descripción de su Profesión / Cargo es obligatoria.', 'error');
            document.getElementById('auth-profesion-solicitante')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!dirTrabajo) {
            showToast('La Dirección de donde se hará el trabajo es obligatoria.', 'error');
            document.getElementById('auth-dir-trabajo')?.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }
          if (!passRules.isValid) {
            showToast('La contraseña debe tener obligatoriamente al menos 6 letras y 4 números.', 'error');
            passInput.focus();
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }

          // Verificar si ya existe cédula o WhatsApp
          const yaExisteCed = await getClienteByCedula(cedula);
          if (yaExisteCed) {
            showToast('Esta cédula ya se encuentra registrada como solicitante.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }

          const yaExisteWA = await getClienteByWA(wa);
          if (yaExisteWA) {
            showToast('Este número de WhatsApp ya se encuentra registrado.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = '📝 Crear Cuenta de Solicitante'; return;
          }

          const hash = await sha256(pass);
          let userCred = null;
          try {
            userCred = await createUserWithEmailAndPassword(auth, emailInput, pass);
          } catch (authErr) {
            if (authErr.code === 'auth/email-already-in-use') {
              const fakeEmailCedula = `${cedula.replace(/[^a-zA-Z0-9]/g, '')}@informaticosvenezuela.com`;
              try {
                userCred = await createUserWithEmailAndPassword(auth, fakeEmailCedula, pass);
              } catch (_) {}
            }
          }

          const uid = userCred ? userCred.user.uid : `cli_${Date.now()}`;

          await guardarCliente(uid, {
            uid: uid,
            nombre: nombre,
            compania: compania,
            direccionCompania: dirCompania,
            cedula: cedula.toUpperCase(),
            cedulaNum: cedula.replace(/[^0-9]/g, ''),
            whatsapp: wa,
            email: emailInput,
            emailPersonal: emailInput,
            profesion: profesion,
            direccionTrabajo: dirTrabajo,
            fotoPerfil: uploadedSolicitanteFotoBase64,
            passwordHash: hash,
            rol: 'solicitante',
            creadoEn: serverTimestamp()
          });

          localStorage.setItem(ROLE_KEY, 'solicitante');
          localStorage.setItem(WA_KEY, wa);
          localStorage.setItem('infovzla_user_cedula', cedula.toUpperCase());
          localStorage.setItem('infovzla_user_nombre', nombre);
          try { localStorage.setItem('infovzla_user_foto', uploadedSolicitanteFotoBase64); } catch(_) {}

          showToast('✅ ¡Cuenta de Solicitante creada exitosamente!', 'success');
          modal.classList.remove('open');
          window.location.reload();
          return;

        } else {
          // ── INICIAR SESIÓN CON VALIDACIÓN ESTRICTA DE ROL (TÉCNICO O SOLICITANTE)
          const userInput = waInput.value.trim();
          if (!userInput) {
            showToast('Ingresa tu Cédula o WhatsApp para ingresar.', 'error');
            waInput.focus();
            submitBtn.disabled = false;
            submitBtn.textContent = selectedRole === 'tecnico' ? '🔑 Iniciar Sesión Técnico' : '🔑 Iniciar Sesión';
            return;
          }

          if (!pass) {
            showToast('Ingresa tu contraseña para ingresar.', 'error');
            passInput.focus();
            submitBtn.disabled = false;
            submitBtn.textContent = selectedRole === 'tecnico' ? '🔑 Iniciar Sesión Técnico' : '🔑 Iniciar Sesión';
            return;
          }

          // ── RECONOCIMIENTO INMEDIATO DEL SUPER ADMINISTRADOR (Cédula 12832779 / Luis Uzcátegui)
          if (isSuperAdminIdentifier(userInput)) {
            const isPassValid = await isSuperAdminPassword(pass);
            if (isPassValid) {
              const dest = (selectedRole === 'tecnico' || window.location.pathname.includes('tecnico.html')) ? 'tecnico.html' : 'admin.html';
              closeModalAuth();
              await loginAsSuperAdmin(pass, dest);
              return;
            } else {
              showToast('❌ Contraseña incorrecta para la cuenta de Super Administrador.', 'error');
              submitBtn.disabled = false;
              submitBtn.textContent = selectedRole === 'tecnico' ? '🔑 Iniciar Sesión Técnico' : '🔑 Iniciar Sesión';
              return;
            }
          }

          if (selectedRole === 'tecnico') {
            // ── LOGIN EXCLUSIVO DE TÉCNICO: PROHIBIDO ENTRAR COMO SOLICITANTE
            let tecExistente = await getTecnicoByCedula(userInput);
            if (!tecExistente) {
              tecExistente = await getTecnicoByWA(userInput);
            }
            if (!tecExistente && userInput.includes('@')) {
              try {
                const qEmail = query(collection(db, COLS.tecnicos), where('email', '==', userInput.toLowerCase()));
                const snapEmail = await getDocs(qEmail);
                if (!snapEmail.empty) tecExistente = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
              } catch (_) {}
            }

            if (!tecExistente) {
              // Comprobar si existe como Solicitante para orientar de inmediato al usuario
              let cliExistente = await getClienteByCedula(userInput);
              if (!cliExistente) cliExistente = await getClienteByWA(userInput);
              if (cliExistente) {
                showToast('ℹ️ Esta cuenta está registrada como Solicitante. Por favor cambia a la pestaña "👤 Solicitante" arriba para ingresar.', 'info');
              } else {
                showToast(`❌ No se encontró ninguna cuenta de Técnico con la Cédula o número (${userInput}). Regístrate en la pestaña Registrarme.`, 'error');
              }
              submitBtn.disabled = false;
              submitBtn.textContent = '🔑 Iniciar Sesión Técnico';
              return;
            }

            // 1. Verificación instantánea por hash SHA-256 local
            const hash = await sha256(pass);
            const hashTrimmed = await sha256(pass.trim());
            const hashMatch = (tecExistente.passwordHash && (tecExistente.passwordHash === hash || tecExistente.passwordHash === hashTrimmed)) || (tecExistente.password && (tecExistente.password === pass || tecExistente.password === pass.trim()));

            let authSuccess = false;
            if (!hashMatch) {
              // 2. Intentar autenticación con Firebase Auth
              const candEmails = [
                tecExistente.email,
                tecExistente.emailPersonal,
                tecExistente.cedula ? `${tecExistente.cedula.replace(/[^a-zA-Z0-9]/g, '')}@informaticosvenezuela.com` : null,
                tecExistente.cedulaNum ? `${tecExistente.cedulaNum}@informaticosvenezuela.com` : null,
                tecExistente.whatsapp ? `${String(tecExistente.whatsapp).replace(/[^0-9]/g, '')}@informaticosvenezuela.com` : null,
                `tec_${tecExistente.cedulaNum || tecExistente.cedula || ''}@informaticosvenezuela.com`
              ].filter(Boolean);

              for (const candEmail of candEmails) {
                try {
                  await signInWithEmailAndPassword(auth, candEmail, pass);
                  authSuccess = true;
                  break;
                } catch (_) {}
              }
            }

            if (authSuccess || hashMatch) {
              if (!tecExistente.passwordHash) {
                try {
                  await updateDoc(doc(db, COLS.tecnicos, tecExistente.id || tecExistente.uid), {
                    passwordHash: hash,
                    updatedAt: serverTimestamp()
                  });
                } catch (_) {}
              }

              localStorage.setItem(ROLE_KEY, 'tecnico');
              if (tecExistente.whatsapp) localStorage.setItem(WA_KEY, tecExistente.whatsapp);
              if (tecExistente.cedula) localStorage.setItem('infovzla_user_cedula', tecExistente.cedula);
              if (tecExistente.nombre) localStorage.setItem('infovzla_user_nombre', tecExistente.nombre);
              if (tecExistente.fotoPerfil) {
                try { localStorage.setItem('infovzla_user_foto', tecExistente.fotoPerfil); } catch (_) {}
              }
              try { localStorage.setItem('infovzla_tecnico_data', JSON.stringify(tecExistente)); } catch(_) {}

              isAdmin = false;
              isTecnico = true;
              userRol = 'tecnico';
              userWhatsApp = tecExistente.whatsapp || null;
              userNombre = tecExistente.nombre || 'Técnico IT';
              userCedula = tecExistente.cedula || userInput;
              userFoto = tecExistente.fotoPerfil || null;
              tecnicoData = tecExistente;
              clienteData = null;
              currentUser = {
                uid: tecExistente.uid || tecExistente.id || tecExistente.cedula || 'tec',
                displayName: userNombre,
                email: tecExistente.email || ''
              };

              showToast('✅ Sesión de Técnico iniciada con éxito', 'success');
              closeModalAuth();
              notifyListeners();
              updateNavUI();
              window.location.href = 'tecnico.html';
              return;
            } else {
              showToast('❌ Contraseña incorrecta para tu cuenta de Técnico.', 'error');
              submitBtn.disabled = false;
              submitBtn.textContent = '🔑 Iniciar Sesión Técnico';
              return;
            }

          } else {
            // ── LOGIN EXCLUSIVO DE SOLICITANTE: PROHIBIDO ENTRAR COMO TÉCNICO
            let cliExistente = await getClienteByCedula(userInput);
            if (!cliExistente) {
              cliExistente = await getClienteByWA(userInput);
            }
            if (!cliExistente && userInput.includes('@')) {
              try {
                const qEmail = query(collection(db, COLS.clientes), where('email', '==', userInput.toLowerCase()));
                const snapEmail = await getDocs(qEmail);
                if (!snapEmail.empty) cliExistente = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
              } catch (_) {}
            }

            if (!cliExistente) {
              // Comprobar si existe como Técnico
              let tecExistente = await getTecnicoByCedula(userInput);
              if (!tecExistente) tecExistente = await getTecnicoByWA(userInput);
              if (tecExistente) {
                showToast('ℹ️ Esta cuenta está registrada como Técnico IT. Por favor cambia a la pestaña "🛠️ Soy Técnico" arriba para ingresar.', 'info');
              } else {
                showToast(`❌ No se encontró ninguna cuenta de Solicitante con la Cédula o número (${userInput}). Regístrate en la pestaña Registrarme.`, 'error');
              }
              submitBtn.disabled = false;
              submitBtn.textContent = '🔑 Iniciar Sesión';
              return;
            }

            // 1. Verificación instantánea por hash SHA-256 local
            const hash = await sha256(pass);
            const hashTrimmed = await sha256(pass.trim());
            let loginPorHash = null;
            try {
              loginPorHash = await loginClienteByHash(cliExistente.whatsapp || userInput, hash);
            } catch (_) {}
            const hashMatch = loginPorHash || (cliExistente.passwordHash && (cliExistente.passwordHash === hash || cliExistente.passwordHash === hashTrimmed)) || (cliExistente.password && (cliExistente.password === pass || cliExistente.password === pass.trim()));

            let authSuccess = false;
            if (!hashMatch) {
              // 2. Intentar autenticación con Firebase Auth
              const candEmails = [
                cliExistente.email,
                cliExistente.emailPersonal,
                cliExistente.cedula ? `${cliExistente.cedula.replace(/[^a-zA-Z0-9]/g, '')}@informaticosvenezuela.com` : null,
                cliExistente.cedulaNum ? `${cliExistente.cedulaNum}@informaticosvenezuela.com` : null,
                cliExistente.whatsapp ? `${String(cliExistente.whatsapp).replace(/[^0-9]/g, '')}@informaticosvenezuela.com` : null,
                `cli_${cliExistente.cedulaNum || cliExistente.cedula || ''}@informaticosvenezuela.com`
              ].filter(Boolean);

              for (const candEmail of candEmails) {
                try {
                  await signInWithEmailAndPassword(auth, candEmail, pass);
                  authSuccess = true;
                  break;
                } catch (_) {}
              }
            }

            if (authSuccess || hashMatch) {
              if (!cliExistente.passwordHash) {
                try {
                  await updateDoc(doc(db, COLS.clientes, cliExistente.id || cliExistente.uid), {
                    passwordHash: hash,
                    updatedAt: serverTimestamp()
                  });
                } catch (_) {}
              }

              localStorage.setItem(ROLE_KEY, 'solicitante');
              if (cliExistente.whatsapp) localStorage.setItem(WA_KEY, cliExistente.whatsapp);
              if (cliExistente.cedula) localStorage.setItem('infovzla_user_cedula', cliExistente.cedula);
              if (cliExistente.nombre) localStorage.setItem('infovzla_user_nombre', cliExistente.nombre);
              if (cliExistente.fotoPerfil) {
                try { localStorage.setItem('infovzla_user_foto', cliExistente.fotoPerfil); } catch (_) {}
              }
              try { localStorage.setItem('infovzla_cliente_data', JSON.stringify(cliExistente)); } catch(_) {}

              isAdmin = false;
              isTecnico = false;
              userRol = 'solicitante';
              userWhatsApp = cliExistente.whatsapp || null;
              userNombre = cliExistente.nombre || 'Solicitante';
              userCedula = cliExistente.cedula || userInput;
              userFoto = cliExistente.fotoPerfil || null;
              clienteData = cliExistente;
              tecnicoData = null;
              currentUser = {
                uid: cliExistente.uid || cliExistente.id || cliExistente.cedula || 'cli',
                displayName: userNombre,
                email: cliExistente.email || ''
              };

              showToast('✅ Sesión de Solicitante iniciada con éxito', 'success');
              closeModalAuth();
              notifyListeners();
              updateNavUI();
              window.location.reload();
              return;
            } else {
              showToast('❌ Contraseña incorrecta para tu cuenta de Solicitante.', 'error');
              submitBtn.disabled = false;
              submitBtn.textContent = '🔑 Iniciar Sesión';
              return;
            }
          }
        }
      } catch (err) {
        console.error('[Auth]', err);
        const msgs = {
          'auth/wrong-password': 'Contraseña incorrecta.',
          'auth/invalid-credential': 'Contraseña incorrecta.',
          'auth/email-already-in-use': 'Este correo o usuario ya tiene una cuenta registrada.',
        };
        showToast(msgs[err.code] || 'Error: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = selectedRole === 'tecnico' ? '🔑 Iniciar Sesión Técnico' : (currentMode === 'registro' ? 'Registrarme' : '🔑 Iniciar Sesión');
      } finally {
        if (submitBtn && submitBtn.textContent === 'Procesando...') {
          submitBtn.disabled = false;
          submitBtn.textContent = selectedRole === 'tecnico' ? '🔑 Iniciar Sesión Técnico' : (currentMode === 'registro' ? 'Registrarme' : '🔑 Iniciar Sesión');
        }
      }
    });
  }

  // Configurar estado inicial al abrir
  document.getElementById('auth-wa').value = '';
  document.getElementById('auth-pass').value = '';
  document.getElementById('auth-pass').type = 'password';
  document.getElementById('auth-toggle-pass').textContent = '👁️';
  document.getElementById('dot-letters').style.background = 'var(--red)';
  document.getElementById('dot-numbers').style.background = 'var(--red)';
  document.getElementById('auth-forgot-panel').style.display = 'none';

  if (typeof modal._setTabAndMode === 'function') {
    modal._setTabAndMode(defaultTab, initialMode, lockRole);
  }

  modal.classList.add('open');
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'all';
}

if (typeof window !== 'undefined') {
  window.openAuthModal = openAuthModal;
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
  localStorage.removeItem(LOCAL_ADMIN_KEY);
  localStorage.removeItem('ives_local_admin');
  localStorage.removeItem(WA_KEY);
  localStorage.removeItem('ives_wa_number');
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem('ives_user_role');
  localStorage.removeItem('infovzla_user_cedula');
  localStorage.removeItem('infovzla_user_foto');
  localStorage.removeItem('infovzla_user_nombre');
  localStorage.removeItem('infovzla_cliente_data');
  localStorage.removeItem('infovzla_tecnico_data');
  
  currentUser  = null;
  isAdmin      = false;
  isTecnico    = false;
  userRol      = null;
  userWhatsApp = null;
  userNombre   = null;
  userCedula   = null;
  userFoto     = null;
  tecnicoData  = null;
  clienteData  = null;

  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('user-logged-in', 'user-is-tecnico', 'user-is-solicitante');
  }
  
  try {
    await signOut(auth);
  } catch (_) {}
  
  notifyListeners();
  updateNavUI();
  
  window.location.href = 'index.html';
}

// ── Modo Admin Local ─────────────────────────────────────────
export function forceAdmin() {
  currentUser = { displayName: 'Luis Uzcátegui (Super Admin)', email: ADMIN_EMAIL, uid: '12832779' };
  isAdmin = true;
  isTecnico = true;
  userRol = 'admin';
  userNombre = 'Luis Uzcátegui';
  userCedula = 'V-12832779';
  userWhatsApp = '04242964339';
  tecnicoData = { ...SUPER_ADMIN_DATA };
  localStorage.setItem(LOCAL_ADMIN_KEY, '1');
  localStorage.setItem('ives_local_admin', '1');
  localStorage.setItem(ROLE_KEY, 'admin');
  localStorage.setItem('ives_user_role', 'admin');
  localStorage.setItem('infovzla_user_cedula', 'V-12832779');
  localStorage.setItem('infovzla_user_nombre', 'Luis Uzcátegui');
  localStorage.setItem(WA_KEY, '04242964339');
  localStorage.setItem('ives_wa_number', '04242964339');
  try { localStorage.setItem('infovzla_tecnico_data', JSON.stringify(SUPER_ADMIN_DATA)); } catch(_) {}
  updateNavUI();
  notifyListeners();
}

(function restoreLocalAdmin() {
  if (typeof localStorage !== 'undefined') {
    const isLocalAdmin = localStorage.getItem(LOCAL_ADMIN_KEY) === '1' || localStorage.getItem('ives_local_admin') === '1' || localStorage.getItem(ROLE_KEY) === 'admin';
    const isLocalSuperCed = isSuperAdminIdentifier(localStorage.getItem('infovzla_user_cedula'));
    if (isLocalAdmin || isLocalSuperCed) {
      currentUser = { displayName: 'Luis Uzcátegui (Super Admin)', email: ADMIN_EMAIL, uid: '12832779' };
      isAdmin = true;
      isTecnico = true;
      userRol = 'admin';
      userNombre = 'Luis Uzcátegui';
      userCedula = 'V-12832779';
      userWhatsApp = '04242964339';
      tecnicoData = { ...SUPER_ADMIN_DATA };
    }
  }
})();

// ── Observador de sesión ─────────────────────────────────────
onAuthStateChanged(auth, async user => {
  const localIsAdmin = localStorage.getItem(LOCAL_ADMIN_KEY) === '1' || localStorage.getItem('ives_local_admin') === '1' || localStorage.getItem(ROLE_KEY) === 'admin';
  const isCedAdmin   = isSuperAdminIdentifier(localStorage.getItem('infovzla_user_cedula'));
  const isFbAdmin    = user?.email === ADMIN_EMAIL;

  if (localIsAdmin || isCedAdmin || isFbAdmin) {
    currentUser  = { displayName: 'Luis Uzcátegui (Super Admin)', email: ADMIN_EMAIL, uid: user?.uid || '12832779' };
    isAdmin      = true;
    isTecnico    = true;
    userRol      = 'admin';
    userNombre   = 'Luis Uzcátegui';
    userCedula   = 'V-12832779';
    userWhatsApp = '04242964339';
    tecnicoData  = { ...SUPER_ADMIN_DATA };
    try { localStorage.setItem('infovzla_tecnico_data', JSON.stringify(SUPER_ADMIN_DATA)); } catch(_) {}
    notifyListeners();
    updateNavUI();
    import('./admin-notifications.js').then(m => m.initGlobalAdminNotifications()).catch(console.error);
    return;
  }

  const savedRole   = localStorage.getItem(ROLE_KEY) || localStorage.getItem('ives_user_role') || null;
  const savedCedula = localStorage.getItem('infovzla_user_cedula') || null;
  const savedWA     = localStorage.getItem(WA_KEY) || localStorage.getItem('ives_wa_number') || null;
  const savedNombre = localStorage.getItem('infovzla_user_nombre') || null;
  const savedFoto   = localStorage.getItem('infovzla_user_foto') || null;

  if (user) {
    isAdmin      = false;
    isTecnico    = savedRole === 'tecnico';
    userRol      = savedRole || 'solicitante';
    userWhatsApp = savedWA;
    userNombre   = savedNombre;
    userCedula   = savedCedula;
    userFoto     = savedFoto;
    currentUser  = user;

    try {
      if (isTecnico) {
        let perfilTec = await getTecnico(user.uid);
        if (!perfilTec && savedCedula) perfilTec = await getTecnicoByCedula(savedCedula);
        if (!perfilTec && savedWA)     perfilTec = await getTecnicoByWA(savedWA);

        if (perfilTec) {
          isTecnico    = true;
          userRol      = 'tecnico';
          tecnicoData  = perfilTec;
          clienteData  = null;
          userWhatsApp = perfilTec.whatsapp || savedWA;
          userNombre   = perfilTec.nombre || savedNombre;
          userCedula   = perfilTec.cedula || savedCedula;
          userFoto     = perfilTec.fotoPerfil || savedFoto;
          localStorage.setItem(WA_KEY, userWhatsApp);
          localStorage.setItem(ROLE_KEY, 'tecnico');
          if (userNombre) localStorage.setItem('infovzla_user_nombre', userNombre);
          if (userCedula) localStorage.setItem('infovzla_user_cedula', userCedula);
          if (userFoto) try { localStorage.setItem('infovzla_user_foto', userFoto); } catch(_) {}
          try { localStorage.setItem('infovzla_tecnico_data', JSON.stringify(perfilTec)); } catch(_) {}
        }
      } else {
        let perfilCli = await getCliente(user.uid);
        if (!perfilCli && savedCedula) perfilCli = await getClienteByCedula(savedCedula);
        if (!perfilCli && savedWA)     perfilCli = await getClienteByWA(savedWA);

        if (perfilCli) {
          isTecnico    = false;
          userRol      = 'solicitante';
          clienteData  = perfilCli;
          tecnicoData  = null;
          userWhatsApp = perfilCli.whatsapp || savedWA;
          userNombre   = perfilCli.nombre || savedNombre;
          userCedula   = perfilCli.cedula || savedCedula;
          userFoto     = perfilCli.fotoPerfil || savedFoto;
          localStorage.setItem(WA_KEY, userWhatsApp);
          localStorage.setItem(ROLE_KEY, 'solicitante');
          if (userNombre) localStorage.setItem('infovzla_user_nombre', userNombre);
          if (userCedula) localStorage.setItem('infovzla_user_cedula', userCedula);
          if (userFoto) try { localStorage.setItem('infovzla_user_foto', userFoto); } catch(_) {}
          try { localStorage.setItem('infovzla_cliente_data', JSON.stringify(perfilCli)); } catch(_) {}
        }
      }
    } catch (e) {
      console.warn('[Auth] Error cargando perfil:', e);
    }
  } else if (savedCedula || savedWA || (savedRole && savedRole !== 'null' && savedRole !== 'undefined')) {
    // Sesión guardada por Cédula o WhatsApp sin Firebase Auth activo
    isAdmin      = false;
    isTecnico    = savedRole === 'tecnico';
    userRol      = savedRole || 'solicitante';
    userWhatsApp = savedWA;
    userNombre   = savedNombre;
    userCedula   = savedCedula;
    userFoto     = savedFoto;

    try {
      if (isTecnico) {
        let perfilTec = null;
        if (savedCedula) perfilTec = await getTecnicoByCedula(savedCedula);
        if (!perfilTec && savedWA) perfilTec = await getTecnicoByWA(savedWA);
        if (!perfilTec && typeof localStorage !== 'undefined' && localStorage.getItem('infovzla_tecnico_data')) {
          try { perfilTec = JSON.parse(localStorage.getItem('infovzla_tecnico_data')); } catch(_) {}
        }

        if (perfilTec) {
          isTecnico    = true;
          userRol      = 'tecnico';
          tecnicoData  = perfilTec;
          clienteData  = null;
          userWhatsApp = perfilTec.whatsapp || savedWA;
          userNombre   = perfilTec.nombre || savedNombre;
          userCedula   = perfilTec.cedula || savedCedula;
          userFoto     = perfilTec.fotoPerfil || savedFoto;
          currentUser  = { uid: perfilTec.uid || perfilTec.id || savedCedula || 'tec', displayName: userNombre, email: perfilTec.email || '' };
          if (userWhatsApp) localStorage.setItem(WA_KEY, userWhatsApp);
          localStorage.setItem(ROLE_KEY, 'tecnico');
          if (userNombre) localStorage.setItem('infovzla_user_nombre', userNombre);
          if (userCedula) localStorage.setItem('infovzla_user_cedula', userCedula);
          if (userFoto) try { localStorage.setItem('infovzla_user_foto', userFoto); } catch(_) {}
          try { localStorage.setItem('infovzla_tecnico_data', JSON.stringify(perfilTec)); } catch(_) {}
        } else {
          currentUser = { uid: savedCedula || savedWA || 'tec', displayName: savedNombre || 'Técnico IT', email: '' };
        }
      } else {
        let perfilCli = null;
        if (savedCedula) perfilCli = await getClienteByCedula(savedCedula);
        if (!perfilCli && savedWA) perfilCli = await getClienteByWA(savedWA);
        if (!perfilCli && typeof localStorage !== 'undefined' && localStorage.getItem('infovzla_cliente_data')) {
          try { perfilCli = JSON.parse(localStorage.getItem('infovzla_cliente_data')); } catch(_) {}
        }

        if (perfilCli) {
          isTecnico    = false;
          userRol      = 'solicitante';
          clienteData  = perfilCli;
          tecnicoData  = null;
          userWhatsApp = perfilCli.whatsapp || savedWA;
          userNombre   = perfilCli.nombre || savedNombre;
          userCedula   = perfilCli.cedula || savedCedula;
          userFoto     = perfilCli.fotoPerfil || savedFoto;
          currentUser  = { uid: perfilCli.uid || perfilCli.id || savedCedula || 'cli', displayName: userNombre, email: perfilCli.email || '' };
          if (userWhatsApp) localStorage.setItem(WA_KEY, userWhatsApp);
          localStorage.setItem(ROLE_KEY, 'solicitante');
          if (userNombre) localStorage.setItem('infovzla_user_nombre', userNombre);
          if (userCedula) localStorage.setItem('infovzla_user_cedula', userCedula);
          if (userFoto) try { localStorage.setItem('infovzla_user_foto', userFoto); } catch(_) {}
          try { localStorage.setItem('infovzla_cliente_data', JSON.stringify(perfilCli)); } catch(_) {}
        } else {
          currentUser = { uid: savedCedula || savedWA || 'cli', displayName: savedNombre || 'Solicitante', email: '' };
        }
      }
    } catch (e) {
      console.warn('[Auth] Error recuperando sesión:', e);
      currentUser = { uid: savedCedula || savedWA || 'user', displayName: savedNombre || (savedRole === 'tecnico' ? 'Técnico IT' : 'Solicitante'), email: '' };
    }
  } else {
    currentUser  = null;
    isAdmin      = false;
    isTecnico    = false;
    userRol      = null;
    userWhatsApp = null;
    userNombre   = null;
    userCedula   = null;
    userFoto     = null;
    tecnicoData  = null;
    clienteData  = null;
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
  let   userAvatar        = document.getElementById('user-avatar');
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

  btnLogin?.classList.add('hidden');

  if (currentUser) {
    const nameToUse = userNombre || currentUser.displayName || (isAdmin ? 'Administrador' : (isTecnico ? 'Técnico IT' : 'Solicitante'));
    const initials = nameToUse.charAt(0).toUpperCase();
    const cedulaToUse = userCedula || localStorage.getItem('infovzla_user_cedula') || '';
    const fotoToUse = userFoto || localStorage.getItem('infovzla_user_foto') || null;

    let userWidget = document.getElementById('nav-user-widget');
    if (!userWidget) {
      userWidget = document.createElement('div');
      userWidget.id = 'nav-user-widget';
      userWidget.style.cssText = 'display:flex; align-items:center; gap:0.5rem; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); padding:3px 8px 3px 4px; border-radius:999px; cursor:pointer; transition:all 0.2s;';
      const navActions = document.querySelector('.nav-actions');
      if (navActions) {
        if (userAvatar) userAvatar.style.display = 'none';
        navActions.appendChild(userWidget);
      }
    }

    if (userWidget) {
      userWidget.style.display = 'flex';
      userWidget.style.borderColor = isTecnico ? 'rgba(246,173,85,0.45)' : (isAdmin ? 'rgba(168,85,247,0.45)' : 'rgba(99,179,237,0.45)');
      userWidget.innerHTML = `
        <div style="width:34px; height:34px; border-radius:50%; overflow:hidden; background:${isTecnico ? '#f6ad55' : (isAdmin ? '#a855f7' : '#3182ce')}; display:flex; align-items:center; justify-content:center; font-weight:800; color:#fff; font-size:0.9rem; flex-shrink:0;">
          ${fotoToUse ? `<img src="${fotoToUse}" alt="Foto Perfil" style="width:100%; height:100%; object-fit:cover;">` : initials}
        </div>
        <div style="display:flex; flex-direction:column; text-align:left; line-height:1.2; padding-right:4px;">
          <span style="font-size:0.82rem; font-weight:700; color:var(--text); white-space:nowrap; max-width:140px; overflow:hidden; text-overflow:ellipsis;">${nameToUse}</span>
          <span style="font-size:0.68rem; font-weight:600; color:${isTecnico ? '#f6ad55' : (isAdmin ? '#c084fc' : '#63b3ed')};">
            ${cedulaToUse ? cedulaToUse + ' • ' : ''}${isTecnico ? 'Técnico IT' : (isAdmin ? 'Admin' : 'Solicitante')}
          </span>
        </div>
      `;

      if (!userWidget.dataset.bound) {
        userWidget.dataset.bound = '1';
        userWidget.addEventListener('click', (e) => {
          e.stopPropagation();
          openProfileDropdown(userWidget);
        });
      }
    }

    if (isAdmin) {
      adminBadge?.classList.remove('hidden');
      if (adminBadge) adminBadge.textContent = '👑 Admin';
      adminLink?.classList.remove('hidden');
      navTecnico?.classList.remove('hidden');
      navSolicitar?.closest('li')?.classList.remove('hidden');
      navMisSolicitudes?.closest('li')?.classList.remove('hidden');
      navMisSolicitudes?.classList.remove('hidden');
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
      navMisSolicitudes?.closest('li')?.classList.remove('hidden');
      navMisSolicitudes?.classList.remove('hidden');
    } else {
      adminBadge?.classList.add('hidden');
      adminLink?.classList.add('hidden');
      navTecnico?.classList.add('hidden');
      navSolicitar?.closest('li')?.classList.remove('hidden');
      navMisSolicitudes?.closest('li')?.classList.remove('hidden');
      navMisSolicitudes?.classList.remove('hidden');
    }
  } else {
    const userWidget = document.getElementById('nav-user-widget');
    if (userWidget) userWidget.style.display = 'none';
    btnLogin?.classList.add('hidden');
    userAvatar?.classList.add('hidden');
    adminBadge?.classList.add('hidden');
    adminLink?.classList.add('hidden');
    navTecnico?.classList.add('hidden');
    navSolicitar?.closest('li')?.classList.remove('hidden');
    navMisSolicitudes?.closest('li')?.classList.add('hidden');
    navMisSolicitudes?.classList.add('hidden');
  }

  // Interceptar clics en 'Solicitar' cuando no ha iniciado sesión
  document.querySelectorAll('a[href="solicitud.html"], #nav-solicitar').forEach(link => {
    if (!link.dataset.authCheckBound) {
      link.dataset.authCheckBound = '1';
      link.addEventListener('click', (e) => {
        if (!currentUser) {
          e.preventDefault();
          openAuthModal('solicitante', 'login', true);
        }
      });
    }
  });
}

// ── Menú desplegable de Perfil con Información Completa ───────
function openProfileDropdown(anchorEl) {
  const existing = document.getElementById('profile-dropdown');
  if (existing) { existing.remove(); return; }

  const nameToUse   = userNombre || currentUser?.displayName || (isAdmin ? 'Administrador' : (isTecnico ? 'Técnico' : 'Solicitante'));
  const cedulaToUse = userCedula || localStorage.getItem('infovzla_user_cedula') || '—';
  const waToUse     = userWhatsApp || localStorage.getItem(WA_KEY) || '—';
  const fotoToUse   = userFoto || localStorage.getItem('infovzla_user_foto') || null;
  const roleLabel   = isAdmin ? '👑 Super Administrador' : (isTecnico ? '⚡ Técnico Especialista IT' : '👤 Solicitante de Servicios');
  const emailToUse  = currentUser?.email || '—';

  const companyOrExp = isTecnico 
    ? (tecnicoData?.zona ? `📍 Zona: ${tecnicoData.zona}` : '')
    : (clienteData?.compania ? `🏢 Empresa: ${clienteData.compania}` : '');

  const profOrSpecs = isTecnico
    ? (tecnicoData?.profesion ? `🛠️ ${tecnicoData.profesion}` : '')
    : (clienteData?.profesion ? `💼 Cargo: ${clienteData.profesion}` : '');

  const dropdown = document.createElement('div');
  dropdown.id = 'profile-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    top: 66px;
    right: 1rem;
    background: #1a202c;
    border: 1px solid ${isTecnico ? 'rgba(246,173,85,0.4)' : 'rgba(99,179,237,0.4)'};
    border-radius: 1.25rem;
    padding: 1.5rem 1.25rem;
    min-width: 290px;
    max-width: 340px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.75);
    z-index: 9999;
    animation: fadeInDown 0.2s ease;
  `;

  dropdown.innerHTML = `
    <style>
      @keyframes fadeInDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      #profile-dropdown .pd-avatar {
        width: 64px; height: 64px; border-radius: 50%;
        background: ${isTecnico ? 'linear-gradient(135deg, #f6ad55, #ed8936)' : 'linear-gradient(135deg, #3182ce, #63b3ed)'};
        display: flex; align-items: center; justify-content: center;
        font-size: 1.6rem; font-weight: 800; color: white;
        margin: 0 auto 0.75rem;
        overflow: hidden;
        border: 2px solid ${isTecnico ? '#f6ad55' : 'var(--blue)'};
      }
      #profile-dropdown .pd-name { font-weight: 800; font-size: 1.05rem; color: var(--text, #fff); text-align: center; margin-bottom: 0.2rem; }
      #profile-dropdown .pd-role { font-size: 0.78rem; font-weight: 700; color: ${isTecnico ? '#f6ad55' : 'var(--blue)'}; text-align: center; margin-bottom: 0.65rem; }
      #profile-dropdown .pd-box { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.65rem; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8rem; text-align: left; }
      #profile-dropdown .pd-row { display: flex; align-items: center; gap: 0.4rem; color: var(--text-muted); margin-bottom: 0.35rem; }
      #profile-dropdown .pd-row:last-child { margin-bottom: 0; }
      #profile-dropdown .pd-link-btn {
        display: block; width: 100%; text-align: center; padding: 0.6rem; margin-top: 0.5rem; border-radius: 0.5rem;
        background: ${isTecnico ? 'rgba(246,173,85,0.18)' : 'rgba(99,179,237,0.18)'}; color: ${isTecnico ? '#f6ad55' : 'var(--blue)'}; font-size: 0.84rem; font-weight: 700; text-decoration: none; border: 1px solid ${isTecnico ? 'rgba(246,173,85,0.35)' : 'rgba(99,179,237,0.35)'};
      }
      #profile-dropdown .pd-divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 0.75rem 0; }
      #profile-dropdown .pd-btn-logout {
        width: 100%; padding: 0.65rem; border-radius: 0.5rem;
        background: rgba(252,129,129,0.12); border: 1px solid rgba(252,129,129,0.35);
        color: #fc8181; font-size: 0.88rem; font-weight: 700; cursor: pointer;
        transition: background 0.2s;
      }
      #profile-dropdown .pd-btn-logout:hover { background: rgba(252,129,129,0.25); }
    </style>
    <div class="pd-avatar">
      ${fotoToUse ? `<img src="${fotoToUse}" alt="Foto" style="width:100%; height:100%; object-fit:cover;">` : nameToUse.charAt(0).toUpperCase()}
    </div>
    <div class="pd-name">${nameToUse}</div>
    <div class="pd-role">${roleLabel}</div>

    <div class="pd-box">
      <div class="pd-row"><span>🆔</span> <strong>Cédula:</strong> <span style="color:var(--text);">${cedulaToUse}</span></div>
      <div class="pd-row"><span>📱</span> <strong>WhatsApp:</strong> <span style="color:var(--text);">${waToUse}</span></div>
      ${companyOrExp ? `<div class="pd-row">${companyOrExp}</div>` : ''}
      ${profOrSpecs ? `<div class="pd-row">${profOrSpecs}</div>` : ''}
    </div>

    ${isTecnico ? `<a href="tecnico.html" class="pd-link-btn">⚡ Ir a mi Panel de Técnico</a>` : ''}
    ${!isTecnico && !isAdmin ? `<a href="mis-solicitudes.html" class="pd-link-btn">📋 Ver Mis Solicitudes</a>` : ''}
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

// ── Soporte Inteligente Dinámico ─────────────────────────────
// Redirige al WhatsApp del técnico que tomó la solicitud activa,
// o por defecto al soporte central 0424-296-4339 (584242964339).
export async function getSmartSupportUrl() {
  const centralNum = '584242964339';
  const defaultUrl = `https://wa.me/${centralNum}?text=${encodeURIComponent('Hola Soporte Informáticos Venezuela, deseo consultar sobre sus servicios técnicos.')}`;

  try {
    const wa = userWhatsApp || localStorage.getItem(WA_KEY);
    const uid = currentUser?.uid;

    if (uid || wa) {
      const coll = collection(db, 'solicitudes');
      let snap = null;

      if (uid) {
        const qUid = query(coll, where('clienteUid', '==', uid));
        snap = await getDocs(qUid);
      }
      if ((!snap || snap.empty) && wa) {
        const cleanWa = wa.replace(/[^0-9]/g, '');
        const qWa = query(coll, where('whatsapp', '==', cleanWa));
        snap = await getDocs(qWa);
      }

      if (snap && !snap.empty) {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const tA = a.creadoEn?.seconds || (a.fecha ? new Date(a.fecha).getTime() : 0);
          const tB = b.creadoEn?.seconds || (b.fecha ? new Date(b.fecha).getTime() : 0);
          return tB - tA;
        });

        // 1. Buscar una solicitud activa que tenga técnico asignado
        const activeWithTech = docs.find(s => s.tecnicoWhatsApp && s.estado !== 'cancelado');
        if (activeWithTech) {
          const tecNum = activeWithTech.tecnicoWhatsApp.replace(/[^0-9]/g, '');
          const tecName = activeWithTech.tecnicoNombre || 'Técnico';
          const serv = activeWithTech.servicio || 'Servicio Técnico';
          const msg = `Hola ${tecName}, te escribo referente a mi solicitud de ${serv} en Informáticos Venezuela.`;
          return {
            url: `https://wa.me/${tecNum}?text=${encodeURIComponent(msg)}`,
            isTecnico: true,
            tecnicoNombre: tecName,
            tecnicoWhatsApp: tecNum,
            servicio: serv,
            solicitudId: activeWithTech.id
          };
        }

        // 2. Si tiene solicitud pero aún sin técnico asignado
        const latest = docs[0];
        if (latest && latest.estado !== 'cancelado') {
          const serv = latest.servicio || 'Servicio Técnico';
          const msg = `Hola Soporte Informáticos Venezuela, deseo consultar el estado de mi solicitud de ${serv}.`;
          return {
            url: `https://wa.me/${centralNum}?text=${encodeURIComponent(msg)}`,
            isTecnico: false,
            servicio: serv,
            solicitudId: latest.id
          };
        }
      }
    }
  } catch (err) {
    console.warn('[SmartSupport] Error buscando técnico asignado:', err);
  }

  return {
    url: defaultUrl,
    isTecnico: false,
    tecnicoNombre: null,
    tecnicoWhatsApp: centralNum
  };
}

export async function openSmartSupportChat() {
  const supportInfo = await getSmartSupportUrl();
  window.open(supportInfo.url, '_blank');
}
window._openSmartSupportChat = openSmartSupportChat;
window._getSmartSupportUrl = getSmartSupportUrl;

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
