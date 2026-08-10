// ============================================================
// solicitud.js — Formulario de Solicitud + Alertas Telegram
// InformaticaVES | El Técnico Luis
// ============================================================

import { guardarSolicitud, getServiciosPublicados, COLS } from './firebase.js';
import { currentUser, getWhatsApp, getUserDisplayName, getUserEmail, showToast } from './auth.js';

// ── Constantes ───────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = '8801695316:AAEXcpwhu4kLvSxUMDE6DZaCAN5pJefyCes';
const TELEGRAM_CHAT_ID   = '8801695316';
const TELEGRAM_API       = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

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
}

// ── Carga de servicios ────────────────────────────────────────
async function cargarServicios() {
  const select = document.getElementById('select-servicio');
  if (!select) return;

  try {
    serviciosDisponibles = await getServiciosPublicados();
  } catch (err) {
    // Si Firestore falla (offline), usar datos del localStorage/cache
    console.warn('[Solicitud] Usando datos en caché:', err);
    serviciosDisponibles = getCachedServicios();
  }

  // Limpiar y poblar select
  select.innerHTML = '<option value="">-- Selecciona un servicio --</option>';

  const grupos = {};
  serviciosDisponibles.forEach(s => {
    if (!grupos[s.categoria]) grupos[s.categoria] = [];
    grupos[s.categoria].push(s);
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
      opt.textContent = `${s.emoji} ${s.nombre} — $${s.precio} ${s.moneda}`;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });
}

function getCachedServicios() {
  try {
    return JSON.parse(localStorage.getItem('ives_servicios') || '[]');
  } catch (_) { return []; }
}

// ── Pre-seleccionar servicio desde URL (?servicio=id) ─────────
function preseleccionarDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('servicio');
  if (!id) return;

  const select = document.getElementById('select-servicio');
  if (select) select.value = id;
  servicioSeleccionado = serviciosDisponibles.find(s => s.id === id) || null;
  updateServiceDetail();
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

  // Submit del formulario
  document.getElementById('form-solicitud')?.addEventListener('submit', handleSubmit);
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
  const wa    = getWhatsApp();
  const name  = getUserDisplayName();
  const email = getUserEmail();

  const inputWA    = document.getElementById('input-whatsapp');
  const inputName  = document.getElementById('input-nombre');
  const inputEmail = document.getElementById('input-email');

  if (wa    && inputWA)    inputWA.value    = wa;
  if (name  && inputName  && name !== 'Cliente') inputName.value  = name;
  if (email && inputEmail) inputEmail.value = email;
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

  const nombre     = document.getElementById('input-nombre')?.value.trim();
  const whatsapp   = document.getElementById('input-whatsapp')?.value.trim();
  const descripcion = document.getElementById('input-descripcion')?.value.trim();

  if (!nombre || !whatsapp) {
    showToast('⚠️ Nombre y WhatsApp son obligatorios', 'error');
    return;
  }

  // Estado de carga
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enviando...';

  const urgConfig = URGENCIA_CONFIG[urgenciaSeleccionada];

  const solicitudData = {
    nombre,
    whatsapp,
    email:        currentUser?.email || '',
    uid:          currentUser?.uid   || 'anon',
    servicio:     servicioSeleccionado.nombre,
    servicioId:   servicioSeleccionado.id,
    precio:       servicioSeleccionado.precio,
    moneda:       servicioSeleccionado.moneda,
    urgencia:     urgenciaSeleccionada,
    urgenciaLabel: urgConfig.label,
    descripcion:  descripcion || '—',
  };

  try {
    // 1. Guardar en Firestore
    await guardarSolicitud(solicitudData);

    // 2. Enviar alerta a Telegram
    await enviarAlertaTelegram(solicitudData, urgConfig);

    // Éxito
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

// ── Alerta a Telegram ─────────────────────────────────────────
async function enviarAlertaTelegram(data, urgConfig) {
  const fecha = new Date().toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const msg = `
${urgConfig.emoji} <b>NUEVA SOLICITUD</b> ${urgConfig.emoji}
━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Prioridad:</b> ${urgConfig.emoji} ${urgConfig.label.toUpperCase()}

👤 <b>Cliente:</b> ${escapeHtml(data.nombre)}
📱 <b>WhatsApp:</b> <a href="https://wa.me/${sanitizeWA(data.whatsapp)}">${escapeHtml(data.whatsapp)}</a>
${data.email ? `📧 <b>Email:</b> ${escapeHtml(data.email)}` : ''}

🔧 <b>Servicio:</b> ${escapeHtml(data.servicio)}
💰 <b>Precio base:</b> $${data.precio} ${data.moneda}

📝 <b>Descripción:</b>
<i>${escapeHtml(data.descripcion)}</i>

🕐 <b>Fecha:</b> ${fecha}
━━━━━━━━━━━━━━━━━━━━━━━━
<i>InformaticaVES — El Técnico Luis</i>
`.trim();

  const response = await fetch(TELEGRAM_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    TELEGRAM_CHAT_ID,
      text:       msg,
      parse_mode: 'HTML',
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Telegram error: ${err.description}`);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeWA(num) {
  return num.replace(/[^\d+]/g, '');
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
          Luis Uzcátegui ha sido notificado y te contactará pronto por WhatsApp.
        </p>
        <div class="alert alert-info" style="text-align:left">
          <div>
            <div><strong>Servicio:</strong> ${escapeHtml(data.servicio)}</div>
            <div><strong>Urgencia:</strong> ${urgConfig.emoji} ${urgConfig.label}</div>
            <div><strong>WhatsApp:</strong> ${escapeHtml(data.whatsapp)}</div>
          </div>
        </div>
        <a href="https://wa.me/584242964339?text=${encodeURIComponent(`Hola Luis, acabo de enviar una solicitud para: ${data.servicio}. Mi nombre es ${data.nombre}.`)}"
           class="btn btn-primary" target="_blank" style="margin-top:0.75rem">
          💬 Contactar por WhatsApp
        </a>
      </div>
    </div>
  `;
  conf.classList.remove('hidden');
  conf.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
