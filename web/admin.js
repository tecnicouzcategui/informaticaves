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
// SOLICITUDES + NOTIFICACIONES (lógica unificada)
// ════════════════════════════════════════════════════════════
let solicitudesList = [];
let solicitudesInitialLoad = true;
let _notifSeenIds = new Set();
let _audioCtx = null;

function _tocarAlarma() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    [[800,0.0],[800,0.15],[1000,0.35],[1000,0.50],[800,0.70]].forEach(([f,t]) => {
      const o = _audioCtx.createOscillator();
      const g = _audioCtx.createGain();
      o.connect(g); g.connect(_audioCtx.destination);
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.4, _audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + t + 0.12);
      o.start(_audioCtx.currentTime + t);
      o.stop(_audioCtx.currentTime + t + 0.13);
    });
  } catch(e) { console.warn('Audio error:', e); }
}

function _mostrarModalAlerta(datos) {
  let modal = document.getElementById('modal-nueva-solicitud-alerta');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-nueva-solicitud-alerta';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9998;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:16px;padding:2rem;max-width:380px;width:90%;text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;">🔔</div>
        <h2 style="color:var(--text,#fff);font-size:1.3rem;margin-bottom:1rem;">¡Nueva Solicitud Recibida!</h2>
        <div id="alerta-contenido" style="background:rgba(0,0,0,0.3);border-radius:8px;padding:1rem;text-align:left;margin-bottom:1.5rem;font-size:0.9rem;"></div>
        <div style="display:flex;gap:1rem;justify-content:center;">
          <button id="alerta-ver" style="background:#4a9eff;color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:8px;cursor:pointer;font-size:0.9rem;">📋 Ver Solicitud</button>
          <button id="alerta-cerrar" style="background:transparent;color:#aaa;border:1px solid #555;padding:0.6rem 1.5rem;border-radius:8px;cursor:pointer;font-size:0.9rem;">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  const urgLabel = datos.urgencia === 'alta' ? '🔴 ALTA' : datos.urgencia === 'media' ? '🟡 MEDIA' : '🟢 BAJA';
  document.getElementById('alerta-contenido').innerHTML =
    `<p>👤 <strong>Cliente:</strong> ${datos.nombre || '—'}</p>
     <p>📱 <strong>WhatsApp:</strong> <span style="color:#68d391">${datos.whatsapp || '—'}</span></p>
     <p>⚡ <strong>Urgencia:</strong> ${urgLabel}</p>
     <p>🔧 <strong>Servicio:</strong> ${datos.servicio || '—'}</p>`;
  modal.style.display = 'flex';
  document.getElementById('alerta-ver').onclick = () => { modal.style.display='none'; if(datos.id) window.verDetalles(datos.id); };
  document.getElementById('alerta-cerrar').onclick = () => { modal.style.display='none'; };
}

function _alertarNuevaSolicitud(datos) {
  _tocarAlarma();
  _mostrarModalAlerta(datos);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('⚡ Nueva Solicitud', { body: `${datos.nombre} — ${datos.servicio}`, icon: './img/logo.png' });
  }
}

async function cargarSolicitudes() {
  const tbody = document.getElementById('solicitudes-tbody');
  if (!tbody) return;

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  const q = query(collection(db, COLS.solicitudes), orderBy('timestamp', 'desc'));

  onSnapshot(q, snap => {
    // ── Detección de nuevas solicitudes (mismo onSnapshot que la tabla) ──

    const ahora = Date.now();
    snap.docChanges().forEach(change => {
      const id = change.doc.id;
      const data = change.doc.data();
      if ((change.type === 'added' || change.type === 'modified') && !data.leida && !_notifSeenIds.has(id)) {
        _notifSeenIds.add(id);
        if (!solicitudesInitialLoad) {
          // Solicitud nueva que llegó después del primer cargado — alertar siempre
          _alertarNuevaSolicitud({ id, ...data });
        } else if (data.timestamp) {
          // Primera carga: solo alertar si es de los últimos 60 segundos
          const docMs = data.timestamp.toDate ? data.timestamp.toDate().getTime() : 0;
          if (ahora - docMs < 60000) _alertarNuevaSolicitud({ id, ...data });
        }
      }
    });
    solicitudesInitialLoad = false;

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

    // Si viene de otra página con el parámetro ?abrir=ID
    const urlParams = new URLSearchParams(window.location.search);
    const idToOpen = urlParams.get('abrir');
    if (idToOpen && solicitudesList.some(s => s.id === idToOpen)) {
      window.history.replaceState({}, document.title, window.location.pathname); // limpiar URL
      setTimeout(() => window.verDetalles(idToOpen), 300);
    }
  });
}

function sanitizeNum(n) { return String(n).replace(/[^\d+]/g, ''); }

window.marcarLeida = async function(id) {
  try {
    await updateDoc(doc(db, COLS.solicitudes, id), { leida: true });
  } catch (err) { showToast(`❌ Error: ${err.message}`, 'error'); }
};

window.borrarTodasSolicitudes = async function() {
  if (!solicitudesList.length) return showToast('No hay solicitudes para borrar', 'info');
  const btn = document.querySelector('button[onclick*="borrarTodasSolicitudes"]');
  if (btn) btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span> Borrando...';
  try {
    const promesas = solicitudesList.map(s => deleteDoc(doc(db, COLS.solicitudes, s.id)));
    await Promise.all(promesas);
    showToast(`✅ ${promesas.length} solicitudes borradas con éxito.`, 'success');
  } catch (err) {
    showToast(`❌ Error al borrar: ${err.message}`, 'error');
  }
  if (btn) btn.innerHTML = '🧹 Borrar Todas';
};


// Las funciones de audio y modal de notificaciones fueron movidas a admin-notifications.js

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
