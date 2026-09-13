import {
  auth, db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  guardarCliente, getCliente, getClienteByWA, getClienteByCedula,
  guardarTecnico, getTecnico, getTecnicoByWA, getTecnicoByCedula,
  sha256, loginClienteByHash, setClientePasswordHash,
  doc, setDoc, serverTimestamp
} from './firebase.js';

// ── Helper: Compresión de Imagen en Cliente (JPG/PNG a Base64 optimizado) ──
function processImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      return reject(new Error('El archivo debe ser una imagen en formato JPG o PNG.'));
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

// ── Constantes ───────────────────────────────────────────────
const ADMIN_EMAIL    = 'tecnicouzcategui@gmail.com';
const WA_KEY         = 'infovzla_wa_number';
const ROLE_KEY       = 'infovzla_user_role';

// ── Estado global ────────────────────────────────────────────
export let currentUser = null;
export let isAdmin     = false;
export let isTecnico   = false;
export let userRol     = null; // 'admin' | 'tecnico' | 'solicitante'
export let userWhatsApp = null;
export let userNombre   = null;
export let userCedula   = null;
export let userFoto     = null;
export let clienteData  = null;
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
export function openAuthModal(defaultTab = 'solicitante', initialMode = 'login', lockRole = true) {
  let modal = document.getElementById('modal-auth-custom');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-auth-custom';
    modal.className = 'modal-backdrop';
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
                <input type="text" class="form-input tec-cualidad-input" placeholder="Renglón 1: Ej: Diagnóstico y reparación de PC / Laptops" style="font-size:0.83rem; padding:0.5rem; flex:1;" value="Diagnóstico y reparación de PC / Laptops Windows y Linux" required>
                <button type="button" class="btn-remove-cualidad" style="background:none; border:none; color:#fc8181; font-size:1.2rem; cursor:pointer; padding:0 4px;" title="Eliminar renglón">&times;</button>
              </div>
              <div class="cualidad-row" style="display:flex; gap:0.4rem; align-items:center;">
                <select class="form-input tec-cualidad-icon" style="width:62px; padding:0.45rem 0.2rem; font-size:1.1rem; text-align:center; background:#1a202c; border:1px solid rgba(246,173,85,0.4); border-radius:6px; cursor:pointer;" title="Selecciona el icono de la especialidad">
                  <option value="💻">💻</option>
                  <option value="📡" selected>📡</option>
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
                <input type="text" class="form-input tec-cualidad-input" placeholder="Renglón 2: Ej: Configuración de redes WiFi y routers" style="font-size:0.83rem; padding:0.5rem; flex:1;" value="Configuración de redes WiFi, routers y cableado">
                <button type="button" class="btn-remove-cualidad" style="background:none; border:none; color:#fc8181; font-size:1.2rem; cursor:pointer; padding:0 4px;" title="Eliminar renglón">&times;</button>
              </div>
              <div class="cualidad-row" style="display:flex; gap:0.4rem; align-items:center;">
                <select class="form-input tec-cualidad-icon" style="width:62px; padding:0.45rem 0.2rem; font-size:1.1rem; text-align:center; background:#1a202c; border:1px solid rgba(246,173,85,0.4); border-radius:6px; cursor:pointer;" title="Selecciona el icono de la especialidad">
                  <option value="💻">💻</option>
                  <option value="📡">📡</option>
                  <option value="📹" selected>📹</option>
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
                <input type="text" class="form-input tec-cualidad-input" placeholder="Renglón 3: Ej: Instalación de cámaras CCTV y seguridad" style="font-size:0.83rem; padding:0.5rem; flex:1;" value="Instalación de cámaras CCTV, DVR, NVR y seguridad">
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

            <small style="color:var(--text-muted); font-size:0.72rem; display:block; margin-top:4px;">Elige el icono y escribe tu especialidad. Puedes agregar, modificar o eliminar renglones.</small>
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
        
        <button id="auth-btn-submit" class="btn btn-primary w-full" disabled style="opacity:0.5; margin-bottom:0.75rem; font-weight:700; padding:0.85rem; font-size:0.95rem;">Ingresar</button>
        
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
      <option value="💻">💻</option>
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
    `;

    function detectIconForText(text) {
      const lower = text.toLowerCase();
      if (lower.includes('wifi') || lower.includes('red') || lower.includes('router') || lower.includes('switch') || lower.includes('internet') || lower.includes('mikrotik')) return '📡';
      if (lower.includes('camara') || lower.includes('cctv') || lower.includes('dvr') || lower.includes('nvr') || lower.includes('seguridad')) return '📹';
      if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') || lower.includes('server') || lower.includes('servidor')) return '🐧';
      if (lower.includes('impresora') || lower.includes('toner') || lower.includes('escaner') || lower.includes('hardware')) return '🖨️';
      if (lower.includes('pc') || lower.includes('laptop') || lower.includes('computadora') || lower.includes('windows') || lower.includes('formateo')) return '💻';
      if (lower.includes('web') || lower.includes('software') || lower.includes('sistema') || lower.includes('sql') || lower.includes('app')) return '🌐';
      if (lower.includes('ups') || lower.includes('electric') || lower.includes('inversor') || lower.includes('voltaje')) return '⚡';
      if (lower.includes('mantenimiento') || lower.includes('limpieza') || lower.includes('reparac')) return '🔧';
      if (lower.includes('celular') || lower.includes('telefono') || lower.includes('movil')) return '📱';
      if (lower.includes('antivirus') || lower.includes('virus') || lower.includes('bloqueo')) return '🔒';
      if (lower.includes('disco') || lower.includes('backup') || lower.includes('respaldo') || lower.includes('recuperacion')) return '💾';
      if (lower.includes('firewall') || lower.includes('ciberseguridad') || lower.includes('vpn')) return '🛡️';
      if (lower.includes('cableado') || lower.includes('utp') || lower.includes('fibra') || lower.includes('rack')) return '🔌';
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
        badgesContainer.innerHTML = `<span style="font-size:0.75rem; color:var(--text-dim); font-style:italic;">Escribe tus especialidades arriba para activar tus iconos aquí.</span>`;
      } else {
        badgesContainer.innerHTML = badges.map(b => `
          <span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(246,173,85,0.18); border:1px solid rgba(246,173,85,0.45); color:#fbd38d; padding:0.25rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:700;">
            <span style="font-size:0.95rem;">${b.icon}</span> ${b.text.length > 25 ? b.text.substring(0, 25) + '...' : b.text}
          </span>
        `).join('');
      }
    }

    function bindRowEvents(row) {
      const input = row.querySelector('.tec-cualidad-input');
      const iconSelect = row.querySelector('.tec-cualidad-icon');
      
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
    }

    // Bind existing rows
    cualidadesList?.querySelectorAll('.cualidad-row').forEach(bindRowEvents);
    updateActiveBadges();

    btnAddCualidad?.addEventListener('click', () => {
      if (!cualidadesList) return;
      const rowCount = cualidadesList.querySelectorAll('.cualidad-row').length + 1;
      const row = document.createElement('div');
      row.className = 'cualidad-row';
      row.style.cssText = 'display:flex; gap:0.4rem; align-items:center;';
      row.innerHTML = `
        <select class="form-input tec-cualidad-icon" style="width:62px; padding:0.45rem 0.2rem; font-size:1.1rem; text-align:center; background:#1a202c; border:1px solid rgba(246,173,85,0.4); border-radius:6px; cursor:pointer;" title="Selecciona el icono de la especialidad">
          ${ICONS_OPTIONS}
        </select>
        <input type="text" class="form-input tec-cualidad-input" placeholder="Renglón ${rowCount}: Escribe otra especialidad técnica..." style="font-size:0.83rem; padding:0.5rem; flex:1;">
        <button type="button" class="btn-remove-cualidad" style="background:none; border:none; color:#fc8181; font-size:1.2rem; cursor:pointer; padding:0 4px;" title="Eliminar renglón">&times;</button>
      `;
      cualidadesList.appendChild(row);
      bindRowEvents(row);
      row.querySelector('.tec-cualidad-input')?.focus();
      updateActiveBadges();
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

      const isReg = currentMode === 'registro';
      let ready = passRules.isValid;

      if (!isReg) {
        // En login requiere identificador y clave válida
        if (!waInput.value.trim()) ready = false;
      }

      submitBtn.disabled = !ready;
      submitBtn.style.opacity = ready ? 1 : 0.5;
    }

    passInput.addEventListener('input', revalidatePassword);
    waInput.addEventListener('input', revalidatePassword);

    closeBtn.addEventListener('click', () => modal.classList.remove('open'));

    submitBtn.addEventListener('click', async () => {
      const pass = passInput.value;
      const passRules = checkPasswordRules(pass);

      if (!passRules.isValid) {
        showToast('La contraseña debe tener obligatoriamente al menos 6 letras y 4 números.', 'error');
        return;
      }

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
              userCred = await createUserWithEmailAndPassword(auth, fakeEmailCedula, pass);
            } else {
              throw authErr;
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
            disponible: true
          });

          localStorage.setItem(ROLE_KEY, 'tecnico');
          localStorage.setItem(WA_KEY, wa);
          localStorage.setItem('infovzla_user_cedula', cedula.toUpperCase());
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
              userCred = await createUserWithEmailAndPassword(auth, fakeEmailCedula, pass);
            } else {
              throw authErr;
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
            rol: 'solicitante'
          });

          localStorage.setItem(ROLE_KEY, 'solicitante');
          localStorage.setItem(WA_KEY, wa);
          localStorage.setItem('infovzla_user_cedula', cedula.toUpperCase());
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
            submitBtn.disabled = false;
            submitBtn.textContent = selectedRole === 'tecnico' ? '🔑 Iniciar Sesión Técnico' : '🔑 Iniciar Sesión';
            return;
          }

          if (selectedRole === 'tecnico') {
            // ── LOGIN EXCLUSIVO DE TÉCNICO: PROHIBIDO ENTRAR COMO SOLICITANTE
            let tecExistente = await getTecnicoByCedula(userInput);
            if (!tecExistente) {
              tecExistente = await getTecnicoByWA(userInput.replace(/[^0-9]/g, ''));
            }

            if (!tecExistente) {
              showToast('❌ No existe una cuenta de Técnico con esta Cédula o teléfono. Si eres Solicitante cambia a la pestaña Solicitante, o pulsa Registrarme para unirte a la red de técnicos.', 'error');
              submitBtn.disabled = false;
              submitBtn.textContent = '🔑 Iniciar Sesión Técnico';
              return;
            }

            const targetEmail = tecExistente.email || `${(tecExistente.whatsapp || tecExistente.cedulaNum || 'tec')}@informaticosvenezuela.com`;

            try {
              try { await signOut(auth); } catch (_) {}
              await signInWithEmailAndPassword(auth, targetEmail, pass);
              localStorage.setItem(ROLE_KEY, 'tecnico');
              localStorage.setItem(WA_KEY, tecExistente.whatsapp);
              localStorage.setItem('infovzla_user_cedula', tecExistente.cedula);
              if (tecExistente.fotoPerfil) {
                try { localStorage.setItem('infovzla_user_foto', tecExistente.fotoPerfil); } catch (_) {}
              }
              showToast('✅ Sesión de Técnico iniciada con éxito', 'success');
              modal.classList.remove('open');
              window.location.href = 'tecnico.html';
              return;
            } catch (e) {
              // Verificar hash en base de datos
              const hash = await sha256(pass);
              if (tecExistente.passwordHash === hash) {
                localStorage.setItem(ROLE_KEY, 'tecnico');
                localStorage.setItem(WA_KEY, tecExistente.whatsapp);
                localStorage.setItem('infovzla_user_cedula', tecExistente.cedula);
                if (tecExistente.fotoPerfil) {
                  try { localStorage.setItem('infovzla_user_foto', tecExistente.fotoPerfil); } catch (_) {}
                }
                showToast('✅ Sesión de Técnico iniciada con éxito', 'success');
                modal.classList.remove('open');
                window.location.href = 'tecnico.html';
                return;
              } else {
                showToast('❌ Contraseña incorrecta para tu cuenta de Técnico.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '🔑 Iniciar Sesión Técnico';
                return;
              }
            }

          } else {
            // ── LOGIN EXCLUSIVO DE SOLICITANTE: PROHIBIDO ENTRAR COMO TÉCNICO
            let cliExistente = await getClienteByCedula(userInput);
            if (!cliExistente) {
              cliExistente = await getClienteByWA(userInput.replace(/[^0-9]/g, ''));
            }

            if (!cliExistente) {
              showToast('❌ No existe una cuenta de Solicitante con esta Cédula o teléfono. Si eres Técnico cambia a la pestaña "Soy Técnico", o pulsa Registrarme.', 'error');
              submitBtn.disabled = false;
              submitBtn.textContent = '🔑 Iniciar Sesión';
              return;
            }

            const targetEmail = cliExistente.email || `${(cliExistente.whatsapp || cliExistente.cedulaNum || 'cli')}@informaticosvenezuela.com`;

            try {
              try { await signOut(auth); } catch (_) {}
              await signInWithEmailAndPassword(auth, targetEmail, pass);
              localStorage.setItem(ROLE_KEY, 'solicitante');
              localStorage.setItem(WA_KEY, cliExistente.whatsapp);
              localStorage.setItem('infovzla_user_cedula', cliExistente.cedula);
              if (cliExistente.fotoPerfil) {
                try { localStorage.setItem('infovzla_user_foto', cliExistente.fotoPerfil); } catch (_) {}
              }
              showToast('✅ Sesión de Solicitante iniciada con éxito', 'success');
              modal.classList.remove('open');
              window.location.reload();
              return;
            } catch (e) {
              // Verificar hash en base de datos
              const hash = await sha256(pass);
              const loginPorHash = await loginClienteByHash(cliExistente.whatsapp || userInput, hash);
              if (loginPorHash || cliExistente.passwordHash === hash) {
                localStorage.setItem(ROLE_KEY, 'solicitante');
                localStorage.setItem(WA_KEY, cliExistente.whatsapp);
                localStorage.setItem('infovzla_user_cedula', cliExistente.cedula);
                if (cliExistente.fotoPerfil) {
                  try { localStorage.setItem('infovzla_user_foto', cliExistente.fotoPerfil); } catch (_) {}
                }
                showToast('✅ Sesión de Solicitante iniciada con éxito', 'success');
                modal.classList.remove('open');
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
        submitBtn.textContent = 'Ingresar';
      }
    });
  }

  // Configurar estado inicial al abrir
  document.getElementById('auth-wa').value = '';
  document.getElementById('auth-pass').value = '';
  document.getElementById('auth-pass').type = 'password';
  document.getElementById('auth-toggle-pass').textContent = '👁️';
  document.getElementById('auth-btn-submit').disabled = true;
  document.getElementById('auth-btn-submit').style.opacity = 0.5;
  document.getElementById('dot-letters').style.background = 'var(--red)';
  document.getElementById('dot-numbers').style.background = 'var(--red)';
  document.getElementById('auth-forgot-panel').style.display = 'none';

  if (typeof modal._setTabAndMode === 'function') {
    modal._setTabAndMode(defaultTab, initialMode, lockRole);
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
  localStorage.removeItem(LOCAL_ADMIN_KEY);
  localStorage.removeItem('ives_local_admin');
  localStorage.removeItem(WA_KEY);
  localStorage.removeItem('ives_wa_number');
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem('ives_user_role');
  
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
const LOCAL_ADMIN_KEY = 'infovzla_local_admin';

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
    currentUser  = { displayName: 'Admin', email: ADMIN_EMAIL, uid: 'local-admin' };
    isAdmin      = true;
    isTecnico    = false;
    userRol      = 'admin';
    userNombre   = 'Administrador Principal';
    userCedula   = 'ADMIN';
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
  userCedula   = localStorage.getItem('infovzla_user_cedula') || null;
  userFoto     = localStorage.getItem('infovzla_user_foto') || null;
  tecnicoData  = null;
  clienteData  = null;

  if (isAdmin && user) {
    localStorage.setItem(LOCAL_ADMIN_KEY, '1');
    localStorage.setItem(ROLE_KEY, 'admin');
    userNombre = 'Administrador Principal';
  }

  if (user) {
    try {
      const activeRole = localStorage.getItem(ROLE_KEY);

      if (activeRole === 'tecnico') {
        // 1. Cargar perfil Técnico
        let perfilTec = await getTecnico(user.uid);
        if (!perfilTec && userWhatsApp) perfilTec = await getTecnicoByWA(userWhatsApp);
        if (!perfilTec && userCedula) perfilTec = await getTecnicoByCedula(userCedula);

        if (perfilTec) {
          isTecnico    = true;
          userRol      = 'tecnico';
          tecnicoData  = perfilTec;
          userWhatsApp = perfilTec.whatsapp;
          userNombre   = perfilTec.nombre;
          userCedula   = perfilTec.cedula || userCedula;
          userFoto     = perfilTec.fotoPerfil || userFoto;
          localStorage.setItem(WA_KEY, perfilTec.whatsapp);
          localStorage.setItem(ROLE_KEY, 'tecnico');
          if (userCedula) localStorage.setItem('infovzla_user_cedula', userCedula);
          if (userFoto) try { localStorage.setItem('infovzla_user_foto', userFoto); } catch(_) {}
        }
      } else {
        // 2. Cargar perfil Cliente / Solicitante
        let perfilCli = await getCliente(user.uid);
        if (!perfilCli && userWhatsApp) perfilCli = await getClienteByWA(userWhatsApp);
        if (!perfilCli && userCedula) perfilCli = await getClienteByCedula(userCedula);

        if (perfilCli) {
          userRol      = 'solicitante';
          clienteData  = perfilCli;
          userWhatsApp = perfilCli.whatsapp;
          userNombre   = perfilCli.nombre;
          userCedula   = perfilCli.cedula || userCedula;
          userFoto     = perfilCli.fotoPerfil || userFoto;
          localStorage.setItem(WA_KEY, perfilCli.whatsapp);
          localStorage.setItem(ROLE_KEY, 'solicitante');
          if (userCedula) localStorage.setItem('infovzla_user_cedula', userCedula);
          if (userFoto) try { localStorage.setItem('infovzla_user_foto', userFoto); } catch(_) {}
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
