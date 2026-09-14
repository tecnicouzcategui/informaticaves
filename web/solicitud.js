// ============================================================
// solicitud.js — Formulario de Solicitud + Alertas Telegram
// Informáticos Venezuela | El Técnico Luis
// ============================================================

import { guardarSolicitud, getServiciosPublicados, SERVICIOS_DEFAULT, COLS } from './firebase.js';
import * as Auth from './auth.js';
import { showToast } from './auth.js';
import { playNewRequestCreatedSound } from './sound-effects.js';
// Nota: currentUser se lee dinámicamente via Auth.currentUser para evitar
// el problema de módulos ES donde el valor primitivo importado queda "congelado".


const URGENCIA_CONFIG = {
  baja:  { emoji: '🟢', label: 'Puede esperar',         color: '#68d391' },
  media: { emoji: '🟡', label: 'Lo más pronto posible', color: '#f6e05e' },
  alta:  { emoji: '🔴', label: 'URGENTE',                color: '#fc8181' },
};

// ── Estado ───────────────────────────────────────────────────
let serviciosDisponibles = [];
let urgenciaSeleccionada = null;
let servicioSeleccionado = null;

// ── Inicialización ────────────────────────────────────────────
export async function initSolicitud() {
  await cargarServicios();
  bindEvents();
  preseleccionarDesdeURL();

  // Bloquear formulario si es administrador o técnico
  function checkRoleAndAdaptUI() {
    const isAdmOrTec = Auth.isAdmin || Auth.isTecnico || localStorage.getItem('infovzla_local_admin') === '1' || localStorage.getItem('infovzla_user_role') === 'admin' || localStorage.getItem('infovzla_user_role') === 'tecnico';
    if (isAdmOrTec) {
      bloquearFormAdmin();
    } else {
      actualizarUI();
    }
  }

  Auth.onAuthChange(checkRoleAndAdaptUI);
  checkRoleAndAdaptUI();
}

function bloquearFormAdmin() {
  const form = document.getElementById('form-solicitud');
  if (!form) return;
  if (document.getElementById('admin-block-msg')) return;

  // Ocultar formulario de cliente y banners de sesión de solicitante
  form.style.display = 'none';
  const guestBanner = document.getElementById('sol-guest-session-banner');
  const userBanner  = document.getElementById('sol-user-session-banner');
  if (guestBanner) guestBanner.style.display = 'none';
  if (userBanner)  userBanner.style.display  = 'none';

  // Insertar aviso visible para el Técnico / Administrador
  const aviso = document.createElement('div');
  aviso.id = 'admin-block-msg';
  aviso.className = 'card';
  aviso.style.cssText = 'text-align:center; padding:3rem 1.5rem; max-width:640px; margin:1.5rem auto; border:1px solid rgba(246,173,85,0.4); background:linear-gradient(135deg, rgba(246,173,85,0.12), rgba(237,137,54,0.04)); border-radius:1rem;';
  aviso.innerHTML = `
    <div style="font-size:3.5rem; margin-bottom:0.75rem;">⚡</div>
    <h2 style="font-size:1.5rem; font-weight:800; color:var(--text); margin-bottom:0.5rem;">Bandeja de Entrada de Solicitudes</h2>
    <p style="color:var(--text-muted); font-size:0.92rem; line-height:1.6; max-width:520px; margin:0 auto 1.75rem;">
      Has iniciado sesión como <strong>Técnico / Administrador (Luis Uzcátegui)</strong>.<br>
      Tu rol es <strong>recibir, aprobar, tomar las solicitudes o trasladarlas a otros técnicos</strong> de la red Help Desk.
    </p>
    <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
      <a href="tecnico.html" class="btn btn-primary" style="background:#f6ad55; color:#1a202c; font-weight:800; padding:0.8rem 1.75rem; font-size:0.92rem; text-decoration:none;">
        📥 Ver Solicitudes de Clientes →
      </a>
      <a href="servicios.html" class="btn btn-secondary" style="font-weight:600; padding:0.8rem 1.25rem; font-size:0.92rem; text-decoration:none;">
        🛠️ Gestionar Servicios
      </a>
    </div>`;
  form.insertAdjacentElement('beforebegin', aviso);
}

function actualizarUI() {
  // Autocompletar con los datos frescos del usuario logueado
  autocompletarDatos();
}

function renderSelectOptions(select, list) {
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Selecciona un servicio requerido --</option>';

  const grupos = {};
  list.forEach(s => {
    const cat = s.categoria || 'soporte';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(s);
  });

  const catLabels = {
    soporte: '💻 Soporte y Software',
    redes:   '📡 Redes y Conectividad',
    cctv:    '📹 CCTV y Seguridad',
    web:     '🌐 Web y Apps',
    movil:   '📱 Móvil y Android',
  };

  Object.entries(grupos).forEach(([cat, items]) => {
    const group = document.createElement('optgroup');
    group.label = catLabels[cat] || cat;
    items.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.emoji || '📌'} ${s.nombre} — $${s.precio} ${s.moneda || 'USD'}`;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });

  if (currentVal) {
    select.value = currentVal;
  }
}

// ── Carga de servicios ────────────────────────────────────────
async function cargarServicios() {
  const select = document.getElementById('select-servicio');
  if (!select) return;

  // 1. Cargar inmediatamente de caché o defaults para evitar spinner/vacío
  const cached = getCachedServicios();
  if (cached && Array.isArray(cached) && cached.length > 0) {
    serviciosDisponibles = cached;
    renderSelectOptions(select, serviciosDisponibles);
    preseleccionarDesdeURL();
  } else {
    serviciosDisponibles = SERVICIOS_DEFAULT.filter(s => s.estado === 'publicado');
    renderSelectOptions(select, serviciosDisponibles);
    preseleccionarDesdeURL();
  }

  // 2. Traer datos frescos de Firestore en segundo plano
  try {
    const fresh = await getServiciosPublicados();
    if (fresh && Array.isArray(fresh) && fresh.length > 0) {
      serviciosDisponibles = fresh;
      renderSelectOptions(select, serviciosDisponibles);
      preseleccionarDesdeURL();
      localStorage.setItem('infovzla_servicios', JSON.stringify(fresh));
    }
  } catch (err) {
    console.warn('[Solicitud] Usando catálogo local:', err);
  }
}

function getCachedServicios() {
  try {
    return JSON.parse(localStorage.getItem('infovzla_servicios') || '[]');
  } catch (_) { return []; }
}

// ── Pre-seleccionar servicio desde URL (?servicio=id o ?cat=categoria) ─────────
function preseleccionarDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('servicio');
  const cat    = params.get('cat');
  const select = document.getElementById('select-servicio');
  if (!select) return;

  if (id) {
    select.value = id;
    servicioSeleccionado = serviciosDisponibles.find(s => s.id === id) || null;
    updateServiceDetail();
    return;
  }

  if (cat) {
    const match = serviciosDisponibles.find(s => s.categoria === cat);
    if (match) {
      select.value = match.id;
      servicioSeleccionado = match;
      updateServiceDetail();
    }
  }
}

// ── Eventos del formulario ────────────────────────────────────
function bindEvents() {
  // Selector de urgencia
  document.querySelectorAll('.urgencia-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.urgencia-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      urgenciaSeleccionada = btn.dataset.value;
    });
  });

  // Cambio de servicio
  document.getElementById('select-servicio')?.addEventListener('change', e => {
    const id = e.target.value;
    servicioSeleccionado = serviciosDisponibles.find(s => s.id === id) || null;
    updateServiceDetail();
  });

  // Autocompletar datos si el usuario está logueado
  autocompletarDatos();

  // GPS
  document.getElementById('btn-gps')?.addEventListener('click', handleGPS);

  // Submit del formulario
  document.getElementById('form-solicitud')?.addEventListener('submit', handleSubmit);

  // Clic en el banner de login abre el modal de autenticación
  document.getElementById('login-suggestion')?.addEventListener('click', () => {
    Auth.openAuthModal();
  });
  document.getElementById('login-link')?.addEventListener('click', (e) => {
    e.stopPropagation();
    Auth.openAuthModal();
  });
}

function updateServiceDetail() {
  const detail = document.getElementById('service-detail');
  if (!detail) return;

  if (!servicioSeleccionado) {
    detail.classList.add('hidden');
    return;
  }

  detail.classList.remove('hidden');
  detail.innerHTML = `
    <div class="alert alert-info">
      <span style="font-size:1.5rem">${servicioSeleccionado.emoji}</span>
      <div>
        <div style="font-weight:700;color:var(--text)">${servicioSeleccionado.nombre}</div>
        <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem">${servicioSeleccionado.descripcion}</div>
        <div style="margin-top:0.4rem;font-family:'Fira Code',monospace;color:var(--green);font-weight:700">
          $${servicioSeleccionado.precio} ${servicioSeleccionado.moneda}
        </div>
      </div>
    </div>
  `;
}

function autocompletarDatos() {
  const wa    = Auth.getWhatsApp();
  const name  = Auth.getUserDisplayName();
  const email = Auth.getUserEmail();

  const inputWA    = document.getElementById('input-whatsapp');
  const inputName  = document.getElementById('input-nombre');
  const inputEmail = document.getElementById('input-email');

  if (Auth.currentUser) {
    // Bloquear visualmente pero NO deshabilitar (disabled impide enviar el valor)
    const lockStyle = 'opacity:0.75; cursor:not-allowed; pointer-events:none; background:rgba(255,255,255,0.04);';
    if (wa && inputWA) { 
      inputWA.value    = wa; 
      inputWA.readOnly = true;
      inputWA.setAttribute('style', lockStyle);
    }
    if (name && inputName && name !== 'Cliente') { 
      inputName.value    = name; 
      inputName.readOnly = true;
      inputName.setAttribute('style', lockStyle);
    }
    // El correo es siempre editable; solo lo vacíamos si es interno
    if (inputEmail) { 
      inputEmail.value = (email && !email.includes('@informaticaves.app') && !email.includes('@informaticosvenezuela.com')) ? email : '';
    }
  } else {
    const freeStyle = '';
    if (inputWA)   { inputWA.readOnly   = false; inputWA.removeAttribute('style'); }
    if (inputName) { inputName.readOnly = false; inputName.removeAttribute('style'); }
  }
}

// ── Lógica GPS ────────────────────────────────────────────────
async function handleGPS() {
  const btn = document.getElementById('btn-gps');
  const txt = document.getElementById('gps-text');
  const icon = document.getElementById('gps-icon');
  const inputDir = document.getElementById('input-direccion');
  const inputCoords = document.getElementById('input-coords');
  
  if (!navigator.geolocation) {
    showToast('Tu navegador no soporta geolocalización', 'error');
    return;
  }

  btn.disabled = true;
  txt.textContent = 'Obteniendo ubicación...';
  icon.textContent = '⏳';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      inputCoords.value = JSON.stringify({ lat: latitude, lng: longitude });
      
      // Intentar reverse geocoding con Nominatim (gratuito)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        if (data && data.display_name) {
          inputDir.value = data.display_name.split(',').slice(0, 3).join(', ');
        } else {
          inputDir.value = `📍 Ubicación GPS capturada`;
        }
      } catch (err) {
        inputDir.value = `📍 Ubicación GPS capturada`;
      }
      
      showToast('Ubicación obtenida correctamente', 'success');
      txt.textContent = 'Ubicación capturada';
      icon.textContent = '✅';
      btn.style.background = 'rgba(104,211,145,0.1)';
      btn.style.color = '#68d391';
      btn.style.borderColor = '#68d391';
      btn.disabled = false;
    },
    (err) => {
      console.warn('GPS Error:', err);
      showToast('No se pudo obtener la ubicación. Verifica los permisos.', 'error');
      txt.textContent = 'Usar mi ubicación actual (GPS)';
      icon.textContent = '📍';
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ── Submit handler ────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  const btn = document.getElementById('btn-enviar');
  if (!btn) return;

  // Validaciones
  if (!urgenciaSeleccionada) {
    showToast('⚠️ Por favor selecciona la urgencia', 'error');
    return;
  }

  if (!servicioSeleccionado) {
    showToast('⚠️ Por favor selecciona un servicio', 'error');
    return;
  }

  // ─── Auth obligatorio ──────────────────────────────────────
  if (!Auth.currentUser) {
    showToast('⚠️ Debes registrarte o iniciar sesión como Solicitante para poder enviar una solicitud.', 'error');
    Auth.openAuthModal('solicitante', 'login', true);
    return;
  }

  // Leer valores del formulario; si el campo está vacío por bug de caché, usar Auth como respaldo
  const nombre      = (document.getElementById('input-nombre')?.value.trim()   || Auth.getUserDisplayName()  || '').trim();
  const whatsapp    = (document.getElementById('input-whatsapp')?.value.trim() || Auth.getWhatsApp()         || '').trim();
  const direccion   = document.getElementById('input-direccion')?.value.trim();
  const coordsStr   = document.getElementById('input-coords')?.value;
  const descripcion = document.getElementById('input-descripcion')?.value.trim();

  if (!nombre || !whatsapp || !direccion) {
    showToast('⚠️ Nombre, WhatsApp y Dirección son obligatorios', 'error');
    return;
  }

  // Estado de carga
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enviando...';

  const urgConfig = URGENCIA_CONFIG[urgenciaSeleccionada];

  const solicitudData = {
    nombre,
    whatsapp,
    email:        Auth.currentUser?.email || '',
    uid:          Auth.currentUser?.uid   || 'anon',
    servicio:     servicioSeleccionado.nombre,
    servicioId:   servicioSeleccionado.id,
    precio:       servicioSeleccionado.precio,
    moneda:       servicioSeleccionado.moneda,
    urgencia:     urgenciaSeleccionada,
    urgenciaLabel: urgConfig.label,
    direccion,
    ubicacionCoords: coordsStr ? JSON.parse(coordsStr) : null,
    descripcion:  descripcion || '—',
    estadoCaso:   'pendiente',
    tecnicoAsignadoId: null,
    tecnicoNombre: null,
    tecnicoWhatsApp: null
  };

  try {
    // 1. Guardar en Firestore
    await guardarSolicitud(solicitudData);

    // 2. Notificar a nuestro Asistente AI (Webhook)
    try {
      fetch('https://e2a47509277fa8.lhr.life/api/webhooks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'Web Informáticos Venezuela',
          email: solicitudData.email || 'tecnicouzcategui@gmail.com',
          content: `Solicitud Web: ${solicitudData.servicio} (${solicitudData.urgenciaLabel})\nCliente: ${solicitudData.nombre} (WhatsApp: ${solicitudData.whatsapp})\nDirección: ${solicitudData.direccion}\nDetalle: ${solicitudData.descripcion}`
        })
      });
    } catch (e) {
      console.warn('[Solicitud] Error enviando a Webhook AI:', e);
    }

    // Éxito con sonido de confirmación y vibración
    playNewRequestCreatedSound();
    showToast('✅ Solicitud enviada correctamente', 'success');
    mostrarConfirmacion(solicitudData, urgConfig);
    e.target.reset();
    document.querySelectorAll('.urgencia-option').forEach(b => b.classList.remove('selected'));
    urgenciaSeleccionada  = null;
    servicioSeleccionado  = null;
    document.getElementById('service-detail')?.classList.add('hidden');

  } catch (err) {
    console.error('[Solicitud] Error:', err);
    showToast('❌ Error al enviar. Por favor intenta de nuevo.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>📤</span> Enviar Solicitud';
  }
}


function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Confirmación visual ───────────────────────────────────────
function mostrarConfirmacion(data, urgConfig) {
  const conf = document.getElementById('confirmacion');
  if (!conf) return;

  conf.innerHTML = `
    <div class="card" style="border-color:rgba(104,211,145,0.3);background:rgba(104,211,145,0.05);">
      <div style="text-align:center;padding:1rem">
        <div style="font-size:3rem">✅</div>
        <h3 style="font-size:1.2rem;font-weight:800;margin:0.75rem 0 0.5rem">¡Solicitud enviada!</h3>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1rem">
          Tu solicitud ha sido registrada en el sistema de Help Desk y el equipo técnico te contactará a la brevedad.
        </p>
        <div class="alert alert-info" style="text-align:left">
          <div>
            <div><strong>Servicio:</strong> ${escapeHtml(data.servicio)}</div>
            <div><strong>Urgencia:</strong> ${urgConfig.emoji} ${urgConfig.label}</div>
            <div><strong>WhatsApp:</strong> ${escapeHtml(data.whatsapp)}</div>
          </div>
        </div>
        <a href="https://wa.me/584242964339?text=${encodeURIComponent(`Hola Soporte Informáticos Venezuela, acabo de enviar una solicitud para: ${data.servicio}. Mi nombre es ${data.nombre}.`)}"
           class="btn btn-primary" target="_blank" style="margin-top:0.75rem">
          💬 Contactar por WhatsApp
        </a>
      </div>
    </div>
  `;
  conf.classList.remove('hidden');
  conf.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
