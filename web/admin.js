// ============================================================
// admin.js — Panel Administrador (Solo tecnicouzcategui@gmail.com)
// Flujo: Borrador → Vista Previa → Publicado
// InformaticaVES | El Técnico Luis
// ============================================================

import {
  db, auth, collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, where,
  getTodosServicios, COLS,
  actualizarEstadoCaso, getValoraciones,
  seedFAQsIfEmpty
} from './firebase.js';
import { currentUser, isAdmin, onAuthChange, showToast } from './auth.js';

const ADMIN_EMAIL = 'tecnicouzcategui@gmail.com';

// ── Verificación de acceso ────────────────────────────────────
export function initAdmin() {
  onAuthChange((user, admin) => {
    if (!user) {
      showAccesoDenegado('Debes iniciar sesión para acceder al panel.');
      return;
    }
    if (!admin) {
      showAccesoDenegado('Acceso restringido al administrador.');
      return;
    }
    // Acceso concedido — cargar panel
    document.getElementById('admin-access-denied')?.classList.add('hidden');
    document.getElementById('admin-panel')?.classList.remove('hidden');
    
    // Actualizar navbar
    const btnLoginNav = document.getElementById('btn-login');
    if (btnLoginNav) btnLoginNav.classList.add('hidden');
    const avatar = document.getElementById('user-avatar');
    if (avatar) {
      avatar.classList.remove('hidden');
      avatar.textContent = 'A';
      avatar.title = user.email;
    }
    const welcome = document.getElementById('admin-welcome');
    if (welcome) welcome.textContent = `Bienvenido, ${user.email}`;

    initTabs();
    cargarServicios();
    cargarSolicitudes();
    cargarFAQ();
    cargarClientes();
  });
}

function showAccesoDenegado(msg) {
  const panel  = document.getElementById('admin-panel');
  const denied = document.getElementById('admin-access-denied');
  panel?.classList.add('hidden');
  if (denied) {
    denied.classList.remove('hidden');
    const msgEl = denied.querySelector('.denied-msg');
    if (msgEl) msgEl.textContent = msg;
  }
}

// ── Tabs ──────────────────────────────────────────────────────
let activeTab = 'servicios';

function initTabs() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      setActiveTab(tab);
    });
  });
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('hidden', pane.id !== `tab-${tab}`);
  });
}

// ════════════════════════════════════════════════════════════
// SERVICIOS
// ════════════════════════════════════════════════════════════
let servicios = [];

async function cargarServicios() {
  const tbody = document.getElementById('servicios-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem;color:var(--text-dim)"><span class="spinner"></span></td></tr>';

  try {
    const snap = await getDocs(collection(db, COLS.servicios));
    servicios  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    servicios.sort((a, b) => {
      if (a.categoria < b.categoria) return -1;
      if (a.categoria > b.categoria) return 1;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
    renderTablaServicios();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--red);padding:2rem">Error: ${err.message}</td></tr>`;
  }
}

function renderTablaServicios() {
  const tbody = document.getElementById('servicios-tbody');
  if (!tbody) return;

  if (!servicios.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding:3rem;color:var(--text-dim)">
          No hay servicios registrados.
          <div style="margin-top:1rem">
            <button class="btn btn-primary btn-sm" onclick="adminCargarServiciosDefault()">📥 Cargar Catálogo por Defecto</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = servicios.map(s => `
    <tr>
      <td><span style="font-size:1.3rem">${s.emoji || '📌'}</span></td>
      <td style="color:var(--text);font-weight:600">${s.nombre}</td>
      <td style="font-family:'Fira Code',monospace;color:var(--green)">$${s.precio} ${s.moneda}</td>
      <td><span class="status-chip ${s.estado === 'publicado' ? 'status-published' : 'status-draft'}">${s.estado}</span></td>
      <td style="color:var(--text-muted)">${s.categoria}</td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-sm btn-secondary" onclick="adminEditarServicio('${s.id}')">✏️ Editar</button>
          ${s.estado === 'borrador'
            ? `<button class="btn btn-sm btn-success" onclick="adminPublicarServicio('${s.id}')">🚀 Publicar</button>`
            : `<button class="btn btn-sm btn-ghost" onclick="adminDesPublicarServicio('${s.id}')">📦 Borrador</button>`
          }
          <button class="btn btn-sm btn-danger" onclick="adminEliminarServicio('${s.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.adminCargarServiciosDefault = async function() {
  if (!confirm('¿Deseas cargar los servicios predeterminados? Esto los guardará en la base de datos para que puedas editarlos.')) return;
  try {
    const btn = document.querySelector('button[onclick="adminCargarServiciosDefault()"]');
    if (btn) btn.innerHTML = '<span class="spinner"></span> Cargando...';
    
    // Asumimos que SERVICIOS_DEFAULT viene importado de firebase.js
    const { SERVICIOS_DEFAULT } = await import('./firebase.js');
    for (const s of SERVICIOS_DEFAULT) {
      const data = { ...s };
      delete data.id; // Limpiar ID por si acaso
      data.creadoEn = serverTimestamp();
      data.updatedAt = serverTimestamp();
      await addDoc(collection(db, COLS.servicios), data);
    }
    showToast('✅ Catálogo cargado exitosamente', 'success');
    await cargarServicios();
  } catch (err) {
    showToast(`❌ Error al cargar: ${err.message}`, 'error');
  }
};

// ── CRUD Servicios ────────────────────────────────────────────
window.adminEditarServicio = function(id) {
  const s = servicios.find(x => x.id === id);
  if (!s) return;
  openServicioModal(s);
};

window.adminPublicarServicio = async function(id) {
  if (!confirm('¿Publicar este servicio?')) return;
  try {
    await updateDoc(doc(db, COLS.servicios, id), { estado: 'publicado', updatedAt: serverTimestamp() });
    showToast('✅ Servicio publicado', 'success');
    await cargarServicios();
  } catch (err) { showToast(`❌ Error: ${err.message}`, 'error'); }
};

window.adminDesPublicarServicio = async function(id) {
  if (!confirm('¿Mover a borrador?')) return;
  try {
    await updateDoc(doc(db, COLS.servicios, id), { estado: 'borrador', updatedAt: serverTimestamp() });
    showToast('📦 Movido a borrador', 'info');
    await cargarServicios();
  } catch (err) { showToast(`❌ Error: ${err.message}`, 'error'); }
};

window.adminEliminarServicio = async function(id) {
  if (!confirm('¿Eliminar permanentemente? Esta acción no se puede deshacer.')) return;
  try {
    await deleteDoc(doc(db, COLS.servicios, id));
    showToast('🗑 Servicio eliminado', 'info');
    await cargarServicios();
  } catch (err) { showToast(`❌ Error: ${err.message}`, 'error'); }
};

// ── Modal Servicio ────────────────────────────────────────────
let editingServiceId = null;

function openServicioModal(servicio = null) {
  editingServiceId = servicio?.id || null;
  const modal = document.getElementById('modal-servicio');
  if (!modal) return;

  const title = modal.querySelector('.modal-title');
  if (title) title.textContent = servicio ? '✏️ Editar Servicio' : '➕ Nuevo Servicio';

  const fields = ['nombre', 'emoji', 'descripcion', 'precio', 'moneda', 'categoria', 'estado'];
  fields.forEach(f => {
    const el = document.getElementById(`srv-${f}`);
    if (el) {
      if (f === 'categoria') {
        const val = servicio?.categoria || '';
        const options = Array.from(el.options).map(o => o.value);
        const customEl = document.getElementById('srv-categoria-custom');
        
        if (val && !options.includes(val)) {
          el.value = 'otra';
          if (customEl) { customEl.style.display = 'block'; customEl.value = val; }
        } else {
          el.value = val;
          if (customEl) { customEl.style.display = 'none'; customEl.value = ''; }
        }
      } else {
        el.value = servicio?.[f] ?? (f === 'estado' ? 'borrador' : f === 'moneda' ? 'USD' : '');
      }
    }
  });

  modal.classList.add('open');
}

window.adminNuevoServicio = function() { openServicioModal(); };

window.adminGuardarServicio = async function() {
  const campos = ['nombre', 'emoji', 'descripcion', 'precio', 'moneda', 'categoria', 'estado'];
  const data   = {};
  let valid    = true;

  campos.forEach(f => {
    const el = document.getElementById(`srv-${f}`);
    if (!el) return;
    
    let val = el.value.trim();
    if (f === 'categoria' && val === 'otra') {
      const customEl = document.getElementById('srv-categoria-custom');
      val = customEl ? customEl.value.trim() : '';
    }

    if (!val && ['nombre', 'precio', 'categoria'].includes(f)) {
      showToast(`⚠️ El campo "${f}" es obligatorio`, 'error');
      valid = false;
      return;
    }
    data[f] = f === 'precio' ? parseFloat(val) : val;
  });

  if (!valid) return;
  data.updatedAt = serverTimestamp();

  const btn = document.getElementById('btn-guardar-servicio');
  if (btn) btn.disabled = true;

  try {
    if (editingServiceId) {
      await updateDoc(doc(db, COLS.servicios, editingServiceId), data);
      showToast('✅ Servicio actualizado', 'success');
    } else {
      data.creadoEn = serverTimestamp();
      await addDoc(collection(db, COLS.servicios), data);
      showToast('✅ Servicio creado', 'success');
    }
    closeServicioModal();
    await cargarServicios();
  } catch (err) {
    showToast(`❌ Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.closeServicioModal = function() {
  document.getElementById('modal-servicio')?.classList.remove('open');
  editingServiceId = null;
};

// ════════════════════════════════════════════════════════════
// SOLICITUDES
// ════════════════════════════════════════════════════════════
let solicitudesList = [];
let solicitudesInitialLoad = true;

// ── Helpers de notificación nativa (Capacitor) ───────────────
const NOTIF_CHANNEL_ID = 'ives_solicitudes_high';

async function solicitarPermisoNotificaciones() {
  // Capacitor (Android app nativa)
  if (window.Capacitor?.Plugins?.LocalNotifications) {
    const LN = window.Capacitor.Plugins.LocalNotifications;
    try {
      await LN.createChannel({
        id:          NOTIF_CHANNEL_ID,
        name:        'Nuevas Solicitudes',
        description: 'Alertas de nuevas solicitudes de clientes',
        importance:  5,
        sound:       'default',
        vibration:   true,
        lights:      true,
        visibility:  1,
      });
      await LN.requestPermissions();
    } catch (e) {
      console.warn('[Notif] Error configurando canal:', e);
    }
  } 
  // Navegador web estándar (Windows, Android Chrome)
  else if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}

// Request permission on first user interaction to avoid browser blocking
document.body.addEventListener('click', () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, { once: true });

async function dispararNotificacionNativa(data) {
  const urgEmoji = data.urgencia === 'alta' ? '🔴' : data.urgencia === 'media' ? '🟡' : '🟢';
  const title = `${urgEmoji} ¡Nueva Solicitud!`;
  const body = `${data.nombre} solicita: ${data.servicio}`;

  // Capacitor (Android app nativa)
  if (window.Capacitor?.Plugins?.LocalNotifications) {
    const LN = window.Capacitor.Plugins.LocalNotifications;
    try {
      await LN.schedule({
        notifications: [{
          title:        title,
          body:         body,
          id:           Math.floor(Math.random() * 2000000000),
          channelId:    NOTIF_CHANNEL_ID,
          sound:        'default',
          actionTypeId: '',
          extra:        { solicitud: true }
        }]
      });
    } catch (e) {
      console.warn('[Notif] Error disparando notificación nativa:', e);
    }
  } 
  // Navegador web estándar (Windows, Chrome)
  else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: body, icon: 'logo_oficial.png' });
  }
}


async function cargarSolicitudes() {
  const tbody = document.getElementById('solicitudes-tbody');
  if (!tbody) return;

  const q = query(collection(db, COLS.solicitudes), orderBy('timestamp', 'desc'));

  onSnapshot(q, snap => {
    // Detect new unread requests for sound alert
    if (!solicitudesInitialLoad) {
      snap.docChanges().forEach(change => {
        if (change.type === 'added' && !change.doc.data().leida) {
          playNotificationSound();
          dispararNotificacionNativa(change.doc.data());
          mostrarAlertaModal({id: change.doc.id, ...change.doc.data()});
          showToast('🔔 ¡Nueva solicitud recibida!', 'success');
        }
      });
    }

    // Setup inicial de solicitudes
    if (solicitudesInitialLoad) {
      solicitudesInitialLoad = false;
      // Pedir permiso para notificaciones nativas en Capacitor
      solicitarPermisoNotificaciones();
    }

    solicitudesList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!solicitudesList.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-dim)">No hay solicitudes aún.</td></tr>';
      return;
    }

    const estadoChip = (e) => {
      const map = {
        pendiente:         { cls: 'estado-pendiente',  lbl: '🟡 Pendiente' },
        tomado:            { cls: 'estado-tomado',      lbl: '📋 Tomado' },
        en_progreso:       { cls: 'estado-progreso',    lbl: '▶️ En Progreso' },
        finalizado:        { cls: 'estado-finalizado',  lbl: '✅ Finalizado' },
        cancelado:         { cls: 'estado-cancelado',   lbl: '❌ Cancelado' },
      };
      const s = map[e] || map['pendiente'];
      return `<span class="estado-chip ${s.cls}">${s.lbl}</span>`;
    };

    tbody.innerHTML = solicitudesList.map(s => {
      const fecha = s.timestamp?.toDate?.()?.toLocaleString('es-VE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }) || '—';
      const urgEmoji = s.urgencia === 'alta' ? '🔴' : s.urgencia === 'media' ? '🟡' : '🟢';
      const estadoActual = s.estadoCaso || 'pendiente';
      return `
        <tr style="${!s.leida ? 'background:rgba(99,179,237,0.04)' : ''}">
          <td>${urgEmoji}</td>
          <td style="color:var(--text);font-weight:${s.leida ? '400' : '700'}">${s.nombre}</td>
          <td><a href="https://wa.me/${sanitizeNum(s.whatsapp)}" target="_blank" style="color:var(--green)">${s.whatsapp}</a></td>
          <td style="color:var(--text-muted)">${s.servicio}</td>
          <td>${estadoChip(estadoActual)}</td>
          <td style="color:var(--text-dim);font-size:0.8rem">${fecha}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="verDetalles('${s.id}')">👁 Ver</button>
            ${!s.leida ? `<button class="btn btn-sm btn-ghost" onclick="marcarLeida('${s.id}')" style="margin-left:0.25rem;">👁️ Marcar leída</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  });
}

function sanitizeNum(n) { return String(n).replace(/[^\d+]/g, ''); }

window.marcarLeida = async function(id) {
  try {
    await updateDoc(doc(db, COLS.solicitudes, id), { leida: true });
  } catch (err) { showToast(`❌ Error: ${err.message}`, 'error'); }
};


function playNotificationSound() {
  try {
    // Vibración nativa en navegador web (útil en Android Chrome)
    // 5 vibraciones: encendido 200ms, apagado 100ms
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200, 100, 200, 100, 200]);
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const numChimes = 5;
    const chimeDuration = 0.5; // 500ms por campanada
    
    for (let i = 0; i < numChimes; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Onda tipo campana/timbre
      osc.type = 'triangle';
      
      const startTime = ctx.currentTime + (i * chimeDuration);
      
      // Tono alto y claro
      osc.frequency.setValueAtTime(987.77, startTime); // Nota B5
      
      // Envolvente de volumen: ataque rápido y decaimiento exponencial (más fuerte: 0.6)
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.6, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.45);
      gain.gain.setValueAtTime(0, startTime + chimeDuration);
      
      osc.start(startTime);
      osc.stop(startTime + chimeDuration);
    }
  } catch (e) {
    console.warn('[Sound] AudioContext bloqueado o no soportado.', e);
  }
}

function mostrarAlertaModal(data) {
  const urgEmoji = data.urgencia === 'alta' ? '🔴' : data.urgencia === 'media' ? '🟡' : '🟢';
  let modal = document.getElementById('modal-incoming-request');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-incoming-request';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 450px; text-align:center;">
      <h2 style="font-size:1.5rem; margin-bottom:1rem; color:var(--accent);">¡Nueva Solicitud Recibida!</h2>
      <div style="font-size:3rem; margin-bottom:1rem; animation: pulse 2s infinite;">🔔</div>
      
      <div style="background:var(--bg-card); padding:1rem; border-radius:var(--radius-sm); text-align:left; margin-bottom:1.5rem;">
        <p><strong>Cliente:</strong> ${data.nombre}</p>
        <p><strong>WhatsApp:</strong> <span style="color:var(--green)">${data.whatsapp}</span></p>
        <p><strong>Urgencia:</strong> ${urgEmoji} ${data.urgencia.toUpperCase()}</p>
        <p style="margin-top:0.5rem; font-weight:bold; color:var(--text-muted);">${data.servicio}</p>
      </div>

      <div style="display:flex; gap:0.5rem; justify-content:center;">
        <button class="btn btn-primary" onclick="verDetalles('${data.id}'); document.getElementById('modal-incoming-request').classList.remove('open');">Tomar Caso</button>
        <button class="btn btn-ghost" onclick="document.getElementById('modal-incoming-request').classList.remove('open');">Cerrar</button>
      </div>
    </div>
  `;
  modal.classList.add('open');
}

let currentDetalleSolicitudId = null;

window.verDetalles = function(id) {
  const s = solicitudesList.find(x => x.id === id);
  if (!s) return;

  if (!s.leida) window.marcarLeida(id);

  currentDetalleSolicitudId = id;
  const modal = document.getElementById('modal-detalle-solicitud');
  const content = document.getElementById('detalle-solicitud-content');
  if (!modal || !content) return;

  const fecha = s.timestamp?.toDate?.()?.toLocaleString('es-VE') || 'Fecha desconocida';
  const mapaLink = s.ubicacionCoords
    ? `<a href="https://www.google.com/maps/search/?api=1&query=${s.ubicacionCoords.lat},${s.ubicacionCoords.lng}" target="_blank" style="color:var(--blue)">🗺️ Ver en Mapa</a>`
    : '<span style="color:var(--text-dim)">Sin ubicación GPS</span>';

  const estadoMap = {
    pendiente:         '🟡 Pendiente',
    tomado:            '📋 Tomado por el Técnico',
    en_progreso:       '▶️ En Progreso',
    finalizado:        '✅ Finalizado',
    cancelado:         '❌ Cancelado',
  };
  const estadoLabel = estadoMap[s.estadoCaso || 'pendiente'] || '🟡 Pendiente';

  content.innerHTML = `
    <p><strong>Cliente:</strong> ${s.nombre || '—'}</p>
    <p><strong>WhatsApp:</strong> <a href="https://wa.me/${sanitizeNum(s.whatsapp)}" target="_blank" style="color:var(--green)">${s.whatsapp}</a></p>
    <p><strong>Servicio:</strong> ${s.servicio}</p>
    <p><strong>Urgencia:</strong> <span style="text-transform:capitalize">${s.urgencia}</span></p>
    <p><strong>Estado actual:</strong> ${estadoLabel}</p>
    <p><strong>Dirección:</strong> ${s.direccion || '—'}</p>
    <p><strong>Mapa:</strong> ${mapaLink}</p>
    <p><strong>Fecha:</strong> ${fecha}</p>
    <hr style="border:0;border-top:1px solid var(--border);margin:1rem 0">
    <p><strong>Detalles adicionales:</strong><br>${s.detalles || s.descripcion || 'Sin detalles'}</p>
  `;

  const btnFactura = document.getElementById('btn-factura');
  if (s.estadoCaso === 'finalizado') {
    btnFactura.classList.remove('hidden');
    btnFactura.href = `factura.html?id=${id}`;
  } else {
    btnFactura.classList.add('hidden');
  }

  modal.classList.add('open');
};

window.cambiarEstado = async function(nuevoEstado) {
  if (!currentDetalleSolicitudId) return;
  try {
    await updateDoc(doc(db, COLS.solicitudes, currentDetalleSolicitudId), {
      estadoCaso: nuevoEstado,
      estadoCasoUpdatedAt: new Date()
    });
    
    const estadoMap = {
      pendiente:         '🟡 Pendiente',
      tomado:            '📋 Tomado',
      en_progreso:       '▶️ En Progreso',
      finalizado:        '✅ Finalizado',
      cancelado:         '❌ Cancelado',
    };
    showToast(`Estado cambiado a: ${estadoMap[nuevoEstado]}`, 'success');
    
    // Update the local list
    const idx = solicitudesList.findIndex(x => x.id === currentDetalleSolicitudId);
    if (idx >= 0) solicitudesList[idx].estadoCaso = nuevoEstado;
    
    // Si cancela, cerramos el modal directamente
    if (nuevoEstado === 'cancelado') {
      closeDetalleSolicitud();
    } else {
      // Re-render content in modal
      verDetalles(currentDetalleSolicitudId);
    }
  } catch (err) {
    showToast(`❌ Error: ${err.message}`, 'error');
  }
};

window.closeDetalleSolicitud = function() {
  document.getElementById('modal-detalle-solicitud')?.classList.remove('open');
  currentDetalleSolicitudId = null;
};

// ════════════════════════════════════════════════════════════
// FAQ
// ════════════════════════════════════════════════════════════
let faqs = [];
let editingFaqId = null;

async function cargarFAQ() {
  const container = document.getElementById('faq-list');
  if (!container) return;

  try {
    // Migrar FAQs por defecto si la colección está vacía
    await seedFAQsIfEmpty();

    const snap = await getDocs(collection(db, COLS.faq));
    faqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    faqs.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    renderFAQList();
  } catch (err) {
    container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
  }
}

function renderFAQList() {
  const container = document.getElementById('faq-list');
  if (!container) return;

  if (!faqs.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon">❓</div><h3>No hay FAQs</h3><p>Crea la primera pregunta frecuente</p></div>';
    return;
  }

  container.innerHTML = faqs.map(f => `
    <div class="card" style="margin-bottom:0.75rem">
      <div class="flex" style="justify-content:space-between;align-items:flex-start;gap:1rem">
        <div style="flex:1">
          <div style="font-weight:700;color:var(--text);margin-bottom:0.25rem">${f.pregunta}</div>
          <div style="font-size:0.85rem;color:var(--text-muted)">${f.respuesta}</div>
          <div style="margin-top:0.5rem">
            <span class="status-chip ${f.estado === 'publicado' ? 'status-published' : 'status-draft'}">${f.estado}</span>
            <span style="font-size:0.75rem;color:var(--text-dim);margin-left:0.5rem">Orden: ${f.orden || 0}</span>
          </div>
        </div>
        <div class="flex gap-1" style="flex-shrink:0">
          <button class="btn btn-sm btn-secondary" onclick="adminEditarFAQ('${f.id}')">✏️</button>
          ${f.estado === 'borrador'
            ? `<button class="btn btn-sm btn-success" onclick="adminPublicarFAQ('${f.id}')">🚀</button>`
            : `<button class="btn btn-sm btn-ghost" onclick="adminBorradorFAQ('${f.id}')">📦</button>`
          }
          <button class="btn btn-sm btn-danger" onclick="adminEliminarFAQ('${f.id}')">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

window.adminNuevaFAQ    = function() { openFAQModal(); };
window.adminEditarFAQ   = function(id) { openFAQModal(faqs.find(f => f.id === id)); };

window.adminPublicarFAQ = async function(id) {
  await updateDoc(doc(db, COLS.faq, id), { estado: 'publicado', updatedAt: serverTimestamp() });
  showToast('✅ FAQ publicada', 'success');
  await cargarFAQ();
};

window.adminBorradorFAQ = async function(id) {
  await updateDoc(doc(db, COLS.faq, id), { estado: 'borrador', updatedAt: serverTimestamp() });
  showToast('📦 FAQ en borrador', 'info');
  await cargarFAQ();
};

window.adminEliminarFAQ = async function(id) {
  if (!confirm('¿Eliminar esta FAQ?')) return;
  await deleteDoc(doc(db, COLS.faq, id));
  showToast('🗑 FAQ eliminada', 'info');
  await cargarFAQ();
};

function openFAQModal(faq = null) {
  editingFaqId = faq?.id || null;
  document.getElementById('faq-pregunta').value = faq?.pregunta || '';
  document.getElementById('faq-respuesta').value = faq?.respuesta || '';
  document.getElementById('faq-orden').value    = faq?.orden ?? (faqs.length + 1);
  document.getElementById('faq-estado').value   = faq?.estado || 'borrador';
  document.getElementById('modal-faq')?.classList.add('open');
}

window.closeFAQModal = function() {
  document.getElementById('modal-faq')?.classList.remove('open');
  editingFaqId = null;
};

window.adminGuardarFAQ = async function() {
  const pregunta  = document.getElementById('faq-pregunta')?.value.trim();
  const respuesta = document.getElementById('faq-respuesta')?.value.trim();
  const orden     = parseInt(document.getElementById('faq-orden')?.value) || 0;
  const estado    = document.getElementById('faq-estado')?.value || 'borrador';

  if (!pregunta || !respuesta) {
    showToast('⚠️ Pregunta y respuesta son obligatorias', 'error');
    return;
  }

  const data = { pregunta, respuesta, orden, estado, updatedAt: serverTimestamp() };

  try {
    if (editingFaqId) {
      await updateDoc(doc(db, COLS.faq, editingFaqId), data);
      showToast('✅ FAQ actualizada', 'success');
    } else {
      await addDoc(collection(db, COLS.faq), { ...data, creadoEn: serverTimestamp() });
      showToast('✅ FAQ creada', 'success');
    }
    closeFAQModal();
    await cargarFAQ();
  } catch (err) {
    showToast(`❌ Error: ${err.message}`, 'error');
  }
};

// ════════════════════════════════════════════════════════════
// CLIENTES — Historial y Valoraciones
// ════════════════════════════════════════════════════════════
async function cargarClientes() {
  // Cargar valoraciones
  const valList    = document.getElementById('val-list');
  const valBadge   = document.getElementById('val-promedio-badge');
  const histTbody  = document.getElementById('historial-tbody');

  try {
    const valoraciones = await getValoraciones();

    // Calcular promedio
    if (valList) {
      if (!valoraciones.length) {
        valList.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-dim)">Aún no hay valoraciones recibidas.</div>';
        if (valBadge) valBadge.textContent = '';
      } else {
        const promedio = (valoraciones.reduce((s, v) => s + (v.estrellas || 0), 0) / valoraciones.length).toFixed(1);
        if (valBadge) valBadge.textContent = `⭐ Promedio: ${promedio} / 5  (${valoraciones.length} reseñas)`;

        const starsHTML = (n) => {
          let h = '';
          for (let i = 1; i <= 5; i++) h += `<span class="${i <= n ? 'star-on' : 'star-off'}">★</span>`;
          return `<span class="star-display">${h}</span>`;
        };

        valList.innerHTML = valoraciones.map(v => {
          const fecha = v.timestamp?.toDate?.()?.toLocaleDateString('es-VE') || '';
          return `
            <div class="val-card">
              <div class="val-card-stars">${starsHTML(v.estrellas)}</div>
              <div class="val-card-body">
                <div class="val-card-name">${v.clienteNombre || 'Cliente'}</div>
                <div class="val-card-srv">Servicio: ${v.servicio || '—'}</div>
                ${v.comentario ? `<div class="val-card-cmt">"${v.comentario}"</div>` : ''}
                <div class="val-card-date">${fecha} · WA: ${v.clienteWA || '—'}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Historial de todas las solicitudes
    if (histTbody) {
      const snap = await getDocs(collection(db, COLS.solicitudes));
      const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      todas.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

      const estadoMap = {
        pendiente:   { cls: 'estado-pendiente',  lbl: '🟡 Pendiente' },
        tomado:      { cls: 'estado-tomado',      lbl: '📋 Tomado' },
        en_progreso: { cls: 'estado-progreso',    lbl: '▶️ En Progreso' },
        finalizado:  { cls: 'estado-finalizado',  lbl: '✅ Finalizado' },
      };

      if (!todas.length) {
        histTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-dim)">Sin solicitudes aún.</td></tr>';
      } else {
        histTbody.innerHTML = todas.map(s => {
          const fecha = s.timestamp?.toDate?.()?.toLocaleDateString('es-VE') || '—';
          const eKey  = s.estadoCaso || 'pendiente';
          const eInfo = estadoMap[eKey] || estadoMap['pendiente'];
          return `
            <tr>
              <td style="color:var(--text);font-weight:600">${s.nombre || '—'}</td>
              <td><a href="https://wa.me/${sanitizeNum(s.whatsapp || '')}" target="_blank" style="color:var(--green)">${s.whatsapp || '—'}</a></td>
              <td style="color:var(--text-muted)">${s.servicio || '—'}</td>
              <td><span class="estado-chip ${eInfo.cls}">${eInfo.lbl}</span></td>
              <td style="color:var(--text-dim);font-size:0.8rem">${fecha}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    if (valList) valList.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    console.error('[Clientes]', err);
  }
}
