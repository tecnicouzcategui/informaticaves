// ============================================================
// admin.js — Panel Administrador (Solo tecnicouzcategui@gmail.com)
// Flujo: Borrador → Vista Previa → Publicado
// Informáticos Venezuela | El Técnico Luis
// ============================================================

import {
  db, auth, collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, where,
  getTodosServicios, COLS,
  actualizarEstadoCaso, getValoraciones,
  seedFAQsIfEmpty, getTodosTecnicos,
  actualizarEstadoTecnico, asignarTecnicoASolicitud,
  isSuperAdminIdentifier
} from './firebase.js';
import { currentUser, isAdmin, onAuthChange, showToast } from './auth.js';

const ADMIN_EMAIL = 'tecnicouzcategui@gmail.com';
let _panelInited = false;

// ── Helper de Sanitización XSS ───────────────────────────────
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Verificación de acceso ────────────────────────────────────
export function initAdmin() {
  function handleAuth(user, admin) {
    const localAdmin = (typeof localStorage !== 'undefined' && (
      localStorage.getItem('infovzla_local_admin') === '1' ||
      localStorage.getItem('ives_local_admin') === '1' ||
      localStorage.getItem('infovzla_user_role') === 'admin' ||
      isSuperAdminIdentifier(localStorage.getItem('infovzla_user_cedula'))
    ));

    const isSuper = admin || localAdmin || user?.email === ADMIN_EMAIL || isSuperAdminIdentifier(user?.uid);

    if (!user && !isSuper) {
      showAccesoDenegado('Debes iniciar sesión con tu cuenta de Administrador.');
      return;
    }

    if (!isSuper) {
      showAccesoDenegado('Acceso restringido al Administrador Principal.');
      return;
    }

    // Acceso concedido — cargar panel (solo una vez)
    document.getElementById('admin-access-denied')?.classList.add('hidden');
    const deniedEl = document.getElementById('admin-access-denied');
    if (deniedEl) deniedEl.style.display = 'none';
    document.getElementById('admin-panel')?.classList.remove('hidden');

    const welcome = document.getElementById('admin-welcome');
    if (welcome) welcome.textContent = `Bienvenido, Luis Uzcátegui (Super Administrador)`;

    if (_panelInited) return;
    _panelInited = true;
    initTabs();
    cargarSolicitudes();
    cargarTecnicos();
    cargarServicios();
    cargarFAQ();
    cargarClientes();
  }

  // ── Verificar estado INMEDIATAMENTE (sin esperar callbacks futuros)
  handleAuth(currentUser, isAdmin);

  // ── Suscribirse a cambios futuros
  onAuthChange(handleAuth);
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
  // Inicializar visibilidad en el tab activo
  setActiveTab(activeTab);
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

async function cargarSolicitudes() {
  const tbody = document.getElementById('solicitudes-tbody');
  if (!tbody) return;

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  const q = query(collection(db, COLS.solicitudes), orderBy('timestamp', 'desc'));

  onSnapshot(q, async snap => {
    // ── La detección de nuevas solicitudes (audio y notificaciones) fue movida a admin-notifications.js ──
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

    // Cargar valoraciones en paralelo para mostrar en tabla
    const { getValoraciones } = await import('./firebase.js').catch(() => ({ getValoraciones: async () => [] }));
    const todasValoraciones = await getValoraciones().catch(() => []);
    const valoracionMap = {};
    todasValoraciones.forEach(v => { valoracionMap[v.solicitudId] = v; });

    tbody.innerHTML = solicitudesList.map(s => {
      const fecha = s.timestamp?.toDate?.()?.toLocaleString('es-VE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }) || '—';
      const urgEmoji = s.urgencia === 'alta' ? '🔴' : s.urgencia === 'media' ? '🟡' : '🟢';
      const estadoActual = s.estadoCaso || 'pendiente';
      const val = valoracionMap[s.id];
      const ratingCell = val
        ? `<span style="color:#f6e05e;font-size:0.9rem;" title="${escapeHtml(val.comentario || '')}">${'⭐'.repeat(val.estrellas)}${val.estrellas}/5</span>`
        : `<span style="color:var(--text-dim);font-size:0.8rem;">—</span>`;
      
      const tecCell = s.tecnicoNombre
        ? `<div style="display:flex;flex-direction:column;gap:0.2rem;">
             <span class="badge" style="background:rgba(246,173,85,0.15);color:#f6ad55;border:1px solid rgba(246,173,85,0.3);font-size:0.75rem;white-space:nowrap;">⚡ ${escapeHtml(s.tecnicoNombre)}</span>
             <button class="btn btn-ghost btn-sm" style="font-size:0.7rem;padding:0.1rem 0.3rem;color:var(--blue);" onclick="window.abrirModalAsignar('${s.id}')">🔄 Reasignar</button>
           </div>`
        : `<button class="btn btn-sm" style="background:rgba(246,173,85,0.2);color:#f6ad55;border:1px solid rgba(246,173,85,0.4);font-size:0.75rem;padding:0.25rem 0.6rem;font-weight:700;" onclick="window.abrirModalAsignar('${s.id}')">⚡ Asignar</button>`;

      return `
        <tr style="${!s.leida ? 'background:rgba(99,179,237,0.04)' : ''}">
          <td>${urgEmoji}</td>
          <td style="color:var(--text);font-weight:${s.leida ? '400' : '700'}">${escapeHtml(s.nombre)}</td>
          <td><a href="https://wa.me/${sanitizeNum(s.whatsapp)}" target="_blank" style="color:var(--green)">${escapeHtml(s.whatsapp)}</a></td>
          <td style="color:var(--text-muted)"><code style="color:var(--blue);font-weight:700;font-size:0.75rem;margin-right:0.3rem;">${escapeHtml(s.correlativo || ('#' + s.id.substring(0,6)))}</code> ${escapeHtml(s.servicio)}</td>
          <td>${tecCell}</td>
          <td>${estadoChip(estadoActual)}</td>
          <td style="color:var(--text-dim);font-size:0.8rem">${fecha}</td>
          <td>${ratingCell}</td>
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
  if (btn) btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span> Verificando...';

  try {
    const { getValoracionBySolicitud } = await import('./firebase.js');

    // Verificar cuáles tienen valoración (PROTEGIDAS) vs cuáles se pueden borrar
    const checks = await Promise.all(
      solicitudesList.map(async s => ({ s, valorada: !!(await getValoracionBySolicitud(s.id)) }))
    );

    const protegidas = checks.filter(c => c.valorada);
    const borrables  = checks.filter(c => !c.valorada);

    if (!borrables.length) {
      showToast(`🔒 Todas las solicitudes están protegidas (ya fueron valoradas). No se borró nada.`, 'info');
      if (btn) btn.innerHTML = '🧹 Borrar Todas';
      return;
    }

    if (protegidas.length > 0) {
      showToast(`⚠️ ${protegidas.length} solicitud(es) protegida(s) no se borrarán (ya valoradas).`, 'info');
    }

    const promesas = borrables.map(c => deleteDoc(doc(db, COLS.solicitudes, c.s.id)));
    await Promise.all(promesas);
    showToast(`✅ ${promesas.length} solicitudes borradas. ${protegidas.length} protegidas.`, 'success');
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
    <p><strong>Cliente:</strong> ${escapeHtml(s.nombre || '—')}</p>
    <p><strong>WhatsApp:</strong> <a href="https://wa.me/${sanitizeNum(s.whatsapp)}" target="_blank" style="color:var(--green)">${escapeHtml(s.whatsapp)}</a></p>
    <p><strong>Servicio:</strong> ${escapeHtml(s.servicio)}</p>
    <p><strong>Urgencia:</strong> <span style="text-transform:capitalize">${escapeHtml(s.urgencia)}</span></p>
    <p><strong>Estado actual:</strong> ${estadoLabel}</p>
    <p><strong>Dirección:</strong> ${escapeHtml(s.direccion || '—')}</p>
    <p><strong>Mapa:</strong> ${mapaLink}</p>
    <p><strong>Fecha:</strong> ${fecha}</p>
    <hr style="border:0;border-top:1px solid var(--border);margin:1rem 0">
    <p><strong>Detalles adicionales:</strong><br>${escapeHtml(s.detalles || s.descripcion || 'Sin detalles')}</p>
  `;

  const btnFactura = document.getElementById('btn-factura');
  if (s.estadoCaso === 'finalizado') {
    btnFactura.classList.remove('hidden');
    btnFactura.href = `factura.html?id=${id}`;
  } else {
    btnFactura.classList.add('hidden');
  }

  // Verificar si ya fue valorado → bloquear todo
  const estadoBtns = document.getElementById('estado-btns');
  const estadoSection = estadoBtns?.parentElement;

  // Chequeo rápido: importar y verificar valoración
  import('./firebase.js').then(async ({ getValoracionBySolicitud }) => {
    const valoracion = await getValoracionBySolicitud(id);
    if (valoracion) {
      // Caso valorado → BLOQUEAR: ocultar botones de estado
      if (estadoSection) estadoSection.style.display = 'none';
      // Mostrar sello de caso cerrado CON la valoración del cliente
      let sello = document.getElementById('caso-cerrado-badge');
      if (!sello) {
        sello = document.createElement('div');
        sello.id = 'caso-cerrado-badge';
        sello.style.cssText = 'background:rgba(104,211,145,0.08);border:1px solid #68d391;border-radius:10px;padding:1rem;margin-top:1rem;';
        estadoBtns?.parentElement?.after(sello);
      }
      // Generar estrellas visuales
      const totalEstrellas = valoracion.estrellas || 0;
      const estrellasHTML = '⭐'.repeat(totalEstrellas) + '☆'.repeat(5 - totalEstrellas);
      sello.innerHTML = `
        <div style="text-align:center;margin-bottom:0.5rem;color:#68d391;font-weight:700;font-size:0.85rem;">🔒 CASO CERRADO — Valorado por el cliente</div>
        <div style="text-align:center;font-size:1.4rem;margin:0.4rem 0;">${estrellasHTML}</div>
        <div style="text-align:center;color:var(--text);font-weight:600;font-size:0.9rem;">${totalEstrellas}/5 estrellas</div>
        ${valoracion.comentario ? `<div style="margin-top:0.5rem;background:rgba(0,0,0,0.2);border-radius:6px;padding:0.5rem;font-size:0.85rem;color:var(--text-dim);">"${escapeHtml(valoracion.comentario)}"</div>` : ''}
      `;
      sello.style.display = 'block';
      btnFactura.classList.remove('hidden');
      btnFactura.href = `factura.html?id=${id}`;
    } else {
      // No valorado → permitir cambios
      if (estadoSection) estadoSection.style.display = '';
      const sello = document.getElementById('caso-cerrado-badge');
      if (sello) sello.style.display = 'none';
    }
  }).catch(console.error);

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
          <div style="font-weight:700;color:var(--text);margin-bottom:0.25rem">${escapeHtml(f.pregunta)}</div>
          <div style="font-size:0.85rem;color:var(--text-muted)">${escapeHtml(f.respuesta)}</div>
          <div style="margin-top:0.5rem">
            <span class="status-chip ${f.estado === 'publicado' ? 'status-published' : 'status-draft'}">${escapeHtml(f.estado)}</span>
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

window.gestionarClave = async function(identificador, nombreCliente = '') {
  let modal = document.getElementById('modal-gestionar-clave');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-gestionar-clave';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const cleanIdent = (identificador || '').trim();
  const labelCliente = nombreCliente ? `${nombreCliente} (${cleanIdent})` : (cleanIdent || 'Usuario');

  // 1. Mostrar input para que el admin escriba la clave
  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px;text-align:left">
      <button class="modal-close" onclick="document.getElementById('modal-gestionar-clave').classList.remove('open')">✕</button>
      <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:0.5rem">🔑 Resetear Clave de Usuario</h2>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1.25rem">Escribe la nueva contraseña para <b>${escapeHtml(labelCliente)}</b>.</p>
      
      <div class="form-group" style="margin-bottom:0.75rem;">
        <label class="form-label">Identificador (Cédula o WhatsApp)</label>
        <input type="text" id="admin-reset-ident" class="form-input" value="${escapeHtml(cleanIdent)}" placeholder="Ej: V-12345678 o 04121234567">
      </div>

      <div class="form-group" style="position:relative; margin-bottom:0.5rem;">
        <label class="form-label">Nueva Contraseña</label>
        <input type="text" id="admin-new-pass" class="form-input" placeholder="Ej: Pedro2025" autocomplete="off">
      </div>
      
      <div style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:1.25rem; font-size:0.75rem; color:var(--text-dim);">
        <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-al" style="width:8px;height:8px;border-radius:50%;background:var(--red);"></div> Mínimo 4 letras</div>
        <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-au" style="width:8px;height:8px;border-radius:50%;background:var(--red);"></div> Al menos 1 mayúscula</div>
        <div style="display:flex; align-items:center; gap:0.5rem;"><div id="dot-an" style="width:8px;height:8px;border-radius:50%;background:var(--red);"></div> Mínimo 4 números</div>
      </div>

      <button id="btn-save-admin-pass" class="btn btn-primary w-full" disabled style="opacity:0.5;background:var(--blue);color:white;padding:0.75rem;">Guardar y Enviar por WhatsApp</button>
    </div>
  `;
  modal.classList.add('open');

  const inputIdent = document.getElementById('admin-reset-ident');
  const inputPass  = document.getElementById('admin-new-pass');
  const btnSave    = document.getElementById('btn-save-admin-pass');
  const dotAl      = document.getElementById('dot-al');
  const dotAu      = document.getElementById('dot-au');
  const dotAn      = document.getElementById('dot-an');

  inputPass.addEventListener('input', () => {
    const val = inputPass.value;
    const hasLetters = (val.match(/[a-zA-Z]/g) || []).length >= 4;
    const hasUpper = (val.match(/[A-Z]/g) || []).length >= 1;
    const hasNumbers = (val.match(/[0-9]/g) || []).length >= 4;

    dotAl.style.background = hasLetters ? 'var(--green)' : 'var(--red)';
    dotAu.style.background = hasUpper ? 'var(--green)' : 'var(--red)';
    dotAn.style.background = hasNumbers ? 'var(--green)' : 'var(--red)';

    if (hasLetters && hasUpper && hasNumbers) {
      btnSave.disabled = false;
      btnSave.style.opacity = 1;
    } else {
      btnSave.disabled = true;
      btnSave.style.opacity = 0.5;
    }
  });

  btnSave.addEventListener('click', async () => {
    const targetIdent = inputIdent.value.trim();
    const tempPass    = inputPass.value;

    if (!targetIdent) {
      showToast('Ingresa la Cédula o número de WhatsApp.', 'error');
      return;
    }

    modal.innerHTML = `
      <div class="modal-box" style="max-width:420px;text-align:center;padding:2rem">
        <span class="spinner"></span>
        <p style="margin-top:1rem;color:var(--text-muted)">Actualizando contraseña en la base de datos…</p>
      </div>
    `;

    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tempPass));
      const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');

      const { db, collection, query, where, getDocs, doc, updateDoc, serverTimestamp } = await import('./firebase.js');
      
      // Buscar primero en clientes
      let docToUpdate = null;
      let targetCollection = 'clientes';
      let cleanWa = targetIdent.replace(/[^0-9]/g, '');
      let cleanCed = targetIdent.toUpperCase();

      // 1. En clientes por whatsapp
      let snap = await getDocs(query(collection(db, 'clientes'), where('whatsapp', '==', targetIdent)));
      if (snap.empty && cleanWa) {
        snap = await getDocs(query(collection(db, 'clientes'), where('whatsapp', '==', cleanWa)));
      }
      if (snap.empty) {
        snap = await getDocs(query(collection(db, 'clientes'), where('cedula', '==', cleanCed)));
      }
      if (snap.empty && cleanWa) {
        snap = await getDocs(query(collection(db, 'clientes'), where('cedulaNum', '==', cleanWa)));
      }

      if (!snap.empty) {
        docToUpdate = snap.docs[0];
        targetCollection = 'clientes';
      } else {
        // 2. Buscar en técnicos
        let tecSnap = await getDocs(query(collection(db, 'tecnicos'), where('whatsapp', '==', targetIdent)));
        if (tecSnap.empty && cleanWa) {
          tecSnap = await getDocs(query(collection(db, 'tecnicos'), where('whatsapp', '==', cleanWa)));
        }
        if (tecSnap.empty) {
          tecSnap = await getDocs(query(collection(db, 'tecnicos'), where('cedula', '==', cleanCed)));
        }
        if (tecSnap.empty && cleanWa) {
          tecSnap = await getDocs(query(collection(db, 'tecnicos'), where('cedulaNum', '==', cleanWa)));
        }
        if (!tecSnap.empty) {
          docToUpdate = tecSnap.docs[0];
          targetCollection = 'tecnicos';
        }
      }

      if (docToUpdate) {
        await updateDoc(doc(db, targetCollection, docToUpdate.id), {
          passwordHash: hash,
          updatedAt: serverTimestamp()
        });
      } else {
        throw new Error(`No se encontró ningún usuario o técnico con identificador "${targetIdent}".`);
      }

      const userData = docToUpdate.data();
      const userPhone = userData.whatsapp || targetIdent;
      const waNum = '58' + userPhone.replace(/\D/g,'').slice(-10);
      const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(
        `¡Hola *${userData.nombre || 'estimado usuario'}*! Hemos restablecido tu acceso a *Informáticos Venezuela*.\n\n🔑 Tu nueva contraseña es:\n\n*${tempPass}*\n\nYa puedes ingresar a la plataforma con tu cédula y esta contraseña. ¡Saludos!`
      )}`;

      modal.innerHTML = `
        <div class="modal-box" style="max-width:420px;text-align:center">
          <button class="modal-close" onclick="document.getElementById('modal-gestionar-clave').classList.remove('open')">✕</button>
          <div style="font-size:2.5rem;margin-bottom:0.5rem">✅</div>
          <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:0.5rem">Contraseña restablecida con éxito</h2>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1.5rem">
            Se actualizó la clave de <b>${escapeHtml(userData.nombre || targetIdent)}</b> a <b>${escapeHtml(tempPass)}</b>.
          </p>
          <a href="${waLink}" target="_blank" 
             class="btn btn-primary w-full" 
             style="background:#25D366;border:none;display:block;text-align:center;text-decoration:none;font-size:1rem;padding:0.85rem"
             onclick="setTimeout(()=>document.getElementById('modal-gestionar-clave').classList.remove('open'),500)">
            💬 Enviar Clave por WhatsApp
          </a>
        </div>
      `;
    } catch(err) {
      modal.innerHTML = `
        <div class="modal-box" style="max-width:420px;text-align:center">
          <button class="modal-close" onclick="document.getElementById('modal-gestionar-clave').classList.remove('open')">✕</button>
          <p style="color:var(--red);margin-bottom:1rem;">❌ Error: ${escapeHtml(err.message)}</p>
          <button class="btn btn-secondary w-full" onclick="document.getElementById('modal-gestionar-clave').classList.remove('open')">Cerrar</button>
        </div>
      `;
    }
  });
};

// ════════════════════════════════════════════════════════════
// CLIENTES — Directorio, Gestión de Usuarios y Valoraciones
// ════════════════════════════════════════════════════════════
let clientesList = [];
let filtroClienteQuery = '';

async function cargarClientes() {
  const tbody = document.getElementById('clientes-tbody');
  const valList = document.getElementById('val-list');
  const valBadge = document.getElementById('val-promedio-badge');
  const histTbody = document.getElementById('historial-tbody');

  // 1. Escuchar la colección de CLIENTES en tiempo real
  onSnapshot(collection(db, COLS.clientes), snap => {
    clientesList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    clientesList.sort((a, b) => {
      const tA = a.creadoEn?.seconds || a.updatedAt?.seconds || 0;
      const tB = b.creadoEn?.seconds || b.updatedAt?.seconds || 0;
      return tB - tA;
    });
    renderTablaClientes();
    actualizarStatClientes();
  }, err => {
    console.error('Error escuchando clientes:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--red);padding:2rem;">Error: ${err.message}</td></tr>`;
  });

  // 2. Cargar valoraciones
  try {
    const valoraciones = await getValoraciones();
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
                <div class="val-card-name">${escapeHtml(v.clienteNombre || 'Cliente')}</div>
                <div class="val-card-srv">Servicio: ${escapeHtml(v.servicio || '—')}</div>
                ${v.comentario ? `<div class="val-card-cmt">"${escapeHtml(v.comentario)}"</div>` : ''}
                <div class="val-card-date">${fecha} · WA: ${escapeHtml(v.clienteWA || '—')}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 3. Historial de todas las solicitudes
    if (histTbody) {
      onSnapshot(query(collection(db, COLS.solicitudes), orderBy('timestamp', 'desc')), snap => {
        const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const estadoMap = {
          pendiente:   { cls: 'estado-pendiente',  lbl: '🟡 Pendiente' },
          tomado:      { cls: 'estado-tomado',      lbl: '📋 Tomado' },
          en_progreso: { cls: 'estado-progreso',    lbl: '▶️ En Progreso' },
          finalizado:  { cls: 'estado-finalizado',  lbl: '✅ Finalizado' },
          cancelado:   { cls: 'estado-cancelado',   lbl: '❌ Cancelado' }
        };

        if (!todas.length) {
          histTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-dim)">Sin solicitudes aún.</td></tr>';
        } else {
          histTbody.innerHTML = todas.map(s => {
            const fecha = s.timestamp?.toDate?.()?.toLocaleDateString('es-VE') || '—';
            const eKey  = s.estadoCaso || 'pendiente';
            const eInfo = estadoMap[eKey] || estadoMap['pendiente'];
            return `
              <tr>
                <td style="color:var(--text);font-weight:600">${escapeHtml(s.nombre || '—')}</td>
                <td><a href="https://wa.me/${sanitizeNum(s.whatsapp || '')}" target="_blank" style="color:var(--green)">${escapeHtml(s.whatsapp || '—')}</a></td>
                <td style="color:var(--text-muted)"><code style="color:var(--blue);font-weight:700;font-size:0.75rem;margin-right:0.3rem;">${escapeHtml(s.correlativo || ('#' + s.id.substring(0,6)))}</code> ${escapeHtml(s.servicio || '—')}</td>
                <td><span class="estado-chip ${eInfo.cls}">${eInfo.lbl}</span></td>
                <td style="color:var(--text-dim);font-size:0.8rem">${fecha}</td>
                <td>
                  <button class="btn btn-sm" style="background:var(--blue);color:white" onclick="window.gestionarClave('${sanitizeNum(s.whatsapp || '')}', '${escapeHtml(s.nombre || '')}')">🔑 Clave</button>
                </td>
              </tr>
            `;
          }).join('');
        }
      });
    }
  } catch (err) {
    if (valList) valList.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    console.error('[Clientes]', err);
  }
}

function actualizarStatClientes() {
  const statEl = document.getElementById('stat-clientes');
  const badgeEl = document.getElementById('badge-total-clientes');
  if (statEl) statEl.textContent = clientesList.length;
  if (badgeEl) badgeEl.textContent = `${clientesList.length} registrados`;
}

window.filtrarClientes = function(query) {
  filtroClienteQuery = (query || '').toLowerCase().trim();
  renderTablaClientes();
};

function renderTablaClientes() {
  const tbody = document.getElementById('clientes-tbody');
  if (!tbody) return;

  let filtrados = clientesList;
  if (filtroClienteQuery) {
    filtrados = clientesList.filter(c => {
      const nombre = (c.nombre || '').toLowerCase();
      const cedula = (c.cedula || '').toLowerCase();
      const wa     = (c.whatsapp || '').toLowerCase();
      const comp   = (c.compania || '').toLowerCase();
      const email  = (c.email || '').toLowerCase();
      return nombre.includes(filtroClienteQuery) || cedula.includes(filtroClienteQuery) || wa.includes(filtroClienteQuery) || comp.includes(filtroClienteQuery) || email.includes(filtroClienteQuery);
    });
  }

  if (!filtrados.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:3rem;color:var(--text-dim)">
          ${filtroClienteQuery ? 'No se encontraron clientes que coincidan con la búsqueda.' : 'No hay clientes registrados en la base de datos.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtrados.map(c => {
    const waNum = sanitizeNum(c.whatsapp || '');
    const waUrl = `https://wa.me/${waNum}`;
    const fecha = c.creadoEn?.toDate?.()?.toLocaleDateString('es-VE') || c.updatedAt?.toDate?.()?.toLocaleDateString('es-VE') || '—';
    const fotoHTML = c.fotoPerfil 
      ? `<img src="${c.fotoPerfil}" alt="Avatar" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--blue);">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:rgba(99,179,237,0.2);display:flex;align-items:center;justify-content:center;color:var(--blue);font-weight:800;font-size:0.9rem;">👤</div>`;

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.6rem;">
            ${fotoHTML}
            <div>
              <div style="font-weight:700;color:var(--text);">${escapeHtml(c.nombre || 'Cliente')}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(c.email || '—')}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge" style="background:rgba(99,179,237,0.15);color:var(--blue);font-weight:700;font-size:0.8rem;">
            ${escapeHtml(c.cedula || '—')}
          </span>
        </td>
        <td>
          <a href="${waUrl}" target="_blank" style="color:var(--green);text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:0.25rem;">
            <span>📱</span> <span>${escapeHtml(c.whatsapp || '—')}</span>
          </a>
        </td>
        <td style="color:var(--text-muted);font-size:0.83rem;">
          <div style="font-weight:600;color:var(--text);">${escapeHtml(c.compania || 'Particular')}</div>
          <div style="font-size:0.75rem;color:var(--text-dim);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.direccionCompania || '—')}</div>
        </td>
        <td style="color:var(--text-muted);font-size:0.82rem;">
          <div>${escapeHtml(c.profesion || '—')}</div>
          ${c.direccionTrabajo ? `<div style="font-size:0.72rem;color:var(--text-dim);">📍 ${escapeHtml(c.direccionTrabajo)}</div>` : ''}
        </td>
        <td style="color:var(--text-dim);font-size:0.8rem;">${fecha}</td>
        <td>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.5rem;" onclick="window.verFichaCliente('${c.id}')" title="Ver ficha completa">👁️ Ficha</button>
            <button class="btn btn-sm" style="background:var(--blue);color:white;font-size:0.75rem;padding:0.25rem 0.5rem;" onclick="window.gestionarClave('${sanitizeNum(c.whatsapp || c.cedula || '')}', '${escapeHtml(c.nombre || '')}')" title="Resetear contraseña">🔑 Clave</button>
            <button class="btn btn-sm btn-danger" style="font-size:0.75rem;padding:0.25rem 0.5rem;" onclick="window.eliminarCliente('${c.id}')" title="Eliminar cliente">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.verFichaCliente = function(clienteId) {
  const c = clientesList.find(x => x.id === clienteId);
  if (!c) return;

  const modal = document.getElementById('modal-ficha-cliente');
  if (!modal) return;

  document.getElementById('ficha-cli-nombre').textContent = c.nombre || 'Cliente';
  document.getElementById('ficha-cli-cedula').textContent = c.cedula || 'V-—';
  
  const avatarBox = document.getElementById('ficha-cli-avatar');
  if (avatarBox) {
    if (c.fotoPerfil) {
      avatarBox.innerHTML = `<img src="${c.fotoPerfil}" alt="Foto" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      avatarBox.innerHTML = '👤';
    }
  }

  const fechaReg = c.creadoEn?.toDate?.()?.toLocaleString('es-VE') || c.updatedAt?.toDate?.()?.toLocaleString('es-VE') || '—';
  const waNum = sanitizeNum(c.whatsapp || '');
  const waUrl = `https://wa.me/${waNum}`;

  document.getElementById('ficha-cli-detalles').innerHTML = `
    <div><strong>👤 1. Nombre Completo:</strong> ${escapeHtml(c.nombre || '—')}</div>
    <div><strong>🆔 2. Cédula (Usuario):</strong> <span style="color:var(--blue);font-weight:700;">${escapeHtml(c.cedula || '—')}</span></div>
    <div><strong>📱 3. WhatsApp / Teléfono:</strong> <a href="${waUrl}" target="_blank" style="color:var(--green);text-decoration:underline;">${escapeHtml(c.whatsapp || '—')}</a></div>
    <div><strong>📧 4. Correo Electrónico:</strong> ${escapeHtml(c.email || '—')}</div>
    <div><strong>🏢 5. Compañía / Empresa:</strong> ${escapeHtml(c.compania || 'Particular')}</div>
    <div><strong>📍 6. Dirección de la Compañía / Sede:</strong> ${escapeHtml(c.direccionCompania || '—')}</div>
    <div><strong>💼 7. Profesión / Cargo:</strong> ${escapeHtml(c.profesion || '—')}</div>
    <div><strong>🛠️ 8. Dirección donde se hará el trabajo:</strong> ${escapeHtml(c.direccionTrabajo || '—')}</div>
    <div><strong>📅 9. Fecha de Registro:</strong> ${fechaReg}</div>
  `;

  const btnWa = document.getElementById('ficha-cli-btn-wa');
  if (btnWa) btnWa.href = waUrl;

  const btnPass = document.getElementById('ficha-cli-btn-pass');
  if (btnPass) {
    btnPass.onclick = () => {
      window.closeFichaClienteModal();
      window.gestionarClave(c.whatsapp || c.cedula, c.nombre);
    };
  }

  modal.classList.add('open');
};

window.closeFichaClienteModal = function() {
  document.getElementById('modal-ficha-cliente')?.classList.remove('open');
};

window.eliminarCliente = async function(clienteId) {
  const c = clientesList.find(x => x.id === clienteId);
  const nombre = c ? c.nombre : 'este cliente';
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${nombre}? Esta acción borrará su cuenta y perfil de la base de datos.`)) return;

  try {
    await deleteDoc(doc(db, COLS.clientes, clienteId));
    showToast('🗑 Cliente eliminado exitosamente', 'info');
  } catch (err) {
    showToast(`❌ Error al eliminar cliente: ${err.message}`, 'error');
  }
};

window.verFichaTecnico = function(tecnicoId) {
  const t = tecnicosList.find(x => x.id === tecnicoId);
  if (!t) return;

  const modal = document.getElementById('modal-ficha-tecnico');
  if (!modal) return;

  document.getElementById('ficha-tec-nombre').textContent = t.nombre || 'Técnico';
  document.getElementById('ficha-tec-cedula').textContent = t.cedula || 'V-—';
  document.getElementById('ficha-tec-estado').textContent = (t.estado || 'activo').toUpperCase();

  const avatarBox = document.getElementById('ficha-tec-avatar');
  if (avatarBox) {
    if (t.fotoPerfil) {
      avatarBox.innerHTML = `<img src="${t.fotoPerfil}" alt="Foto" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      avatarBox.innerHTML = '👨‍🔧';
    }
  }

  const waNum = sanitizeNum(t.whatsapp || '');
  const waUrl = `https://wa.me/${waNum}`;
  const espList = Array.isArray(t.especialidades) ? t.especialidades.join(', ') : (t.especialidades || 'Soporte General');

  document.getElementById('ficha-tec-detalles').innerHTML = `
    <div><strong>👨‍🔧 1. Nombre Completo:</strong> ${escapeHtml(t.nombre || '—')}</div>
    <div><strong>🆔 2. Cédula:</strong> ${escapeHtml(t.cedula || '—')}</div>
    <div><strong>📱 3. WhatsApp:</strong> <a href="${waUrl}" target="_blank" style="color:var(--green);text-decoration:underline;">${escapeHtml(t.whatsapp || '—')}</a></div>
    <div><strong>📧 4. Correo Electrónico:</strong> ${escapeHtml(t.email || '—')}</div>
    <div><strong>⏳ 5. Años de Experiencia:</strong> ${escapeHtml(String(t.experiencia || '0'))} años</div>
    <div><strong>📍 6. Zona de Cobertura:</strong> ${escapeHtml(t.zona || 'General')}</div>
    <div><strong>💼 7. Profesión / Perfil:</strong> ${escapeHtml(t.profesion || '—')}</div>
    <div><strong>⚡ 8. Especialidades:</strong> <div style="margin-top:0.25rem;background:rgba(246,173,85,0.1);padding:0.4rem;border-radius:6px;font-size:0.8rem;color:#fbd38d;">${escapeHtml(espList)}</div></div>
    <div><strong>🟢 9. Disponibilidad:</strong> ${t.disponible !== false ? '🟢 Disponible para nuevos trabajos' : '🔴 Ocupado'}</div>
  `;

  const btnWa = document.getElementById('ficha-tec-btn-wa');
  if (btnWa) btnWa.href = waUrl;

  modal.classList.add('open');
};

window.closeFichaTecnicoModal = function() {
  document.getElementById('modal-ficha-tecnico')?.classList.remove('open');
};

window.eliminarTecnico = async function(tecnicoId) {
  const t = tecnicosList.find(x => x.id === tecnicoId);
  const nombre = t ? t.nombre : 'este técnico';
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al técnico ${nombre}?`)) return;

  try {
    await deleteDoc(doc(db, COLS.tecnicos, tecnicoId));
    showToast('🗑 Técnico eliminado exitosamente', 'info');
  } catch (err) {
    showToast(`❌ Error al eliminar técnico: ${err.message}`, 'error');
  }
};

// ════════════════════════════════════════════════════════════
// GESTIÓN DE RED DE TÉCNICOS & ASIGNACIONES
// ════════════════════════════════════════════════════════════
let tecnicosList = [];
let filtroTecnicoActual = 'todos';

async function cargarTecnicos() {
  const tbody = document.getElementById('tecnicos-tbody');
  if (!tbody) return;

  onSnapshot(collection(db, COLS.tecnicos), snap => {
    tecnicosList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const hasSuper = tecnicosList.some(t => isSuperAdminIdentifier(t.id) || isSuperAdminIdentifier(t.cedula) || isSuperAdminIdentifier(t.email));
    if (!hasSuper) {
      tecnicosList.unshift({ ...SUPER_ADMIN_DATA });
    }
    tecnicosList.sort((a, b) => {
      const tA = a.creadoEn?.seconds || a.updatedAt?.seconds || 0;
      const tB = b.creadoEn?.seconds || b.updatedAt?.seconds || 0;
      return tB - tA;
    });
    renderTablaTecnicos();
    actualizarStatTecnicos();
  }, err => {
    console.error('Error escuchando técnicos:', err);
    if (!tecnicosList.length) {
      tecnicosList = [{ ...SUPER_ADMIN_DATA }];
      renderTablaTecnicos();
      actualizarStatTecnicos();
    }
  });
}

function actualizarStatTecnicos() {
  const statEl = document.getElementById('stat-tecnicos');
  if (statEl) {
    const activos = tecnicosList.filter(t => t.estado === 'activo').length;
    statEl.textContent = activos;
  }
}

window.filtrarTecnicos = function(valor) {
  filtroTecnicoActual = valor;
  renderTablaTecnicos();
};

function renderTablaTecnicos() {
  const tbody = document.getElementById('tecnicos-tbody');
  if (!tbody) return;

  let filtrados = tecnicosList;
  if (filtroTecnicoActual === 'activo') {
    filtrados = tecnicosList.filter(t => t.estado === 'activo');
  } else if (filtroTecnicoActual === 'disponible') {
    filtrados = tecnicosList.filter(t => t.estado === 'activo' && t.disponible !== false);
  } else if (filtroTecnicoActual === 'pendiente') {
    filtrados = tecnicosList.filter(t => t.estado === 'pendiente' || t.estado === 'pendiente_aprobacion');
  } else if (filtroTecnicoActual === 'suspendido') {
    filtrados = tecnicosList.filter(t => t.estado === 'suspendido');
  }

  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--text-dim)">No hay técnicos registrados en este filtro.</td></tr>';
    return;
  }

  tbody.innerHTML = filtrados.map(t => {
    const estado = t.estado || 'activo';
    const disponible = t.disponible !== false;
    const espList = Array.isArray(t.especialidades) ? t.especialidades.join(', ') : (t.especialidades || 'Soporte');
    
    let estadoBadge = `<span class="badge" style="background:rgba(104,211,145,0.15);color:#68d391;">Activo</span>`;
    if (estado === 'pendiente' || estado === 'pendiente_aprobacion') {
      estadoBadge = `<span class="badge" style="background:rgba(246,224,94,0.15);color:#f6e05e;">Pendiente</span>`;
    } else if (estado === 'suspendido') {
      estadoBadge = `<span class="badge" style="background:rgba(252,129,129,0.15);color:#fc8181;">Suspendido</span>`;
    }

    const dispBadge = disponible
      ? `<span style="color:#48bb78;font-size:0.8rem;font-weight:700;">🟢 Disponible</span>`
      : `<span style="color:#fc8181;font-size:0.8rem;">🔴 Ocupado</span>`;

    const waNum = sanitizeNum(t.whatsapp || '');
    const waUrl = `https://wa.me/${waNum}`;

    return `
      <tr>
        <td style="color:var(--text);font-weight:700;">
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <span>⚡</span>
            <span>${escapeHtml(t.nombre || 'Técnico')}</span>
          </div>
        </td>
        <td><a href="${waUrl}" target="_blank" style="color:var(--green);text-decoration:none;">📱 ${escapeHtml(t.whatsapp || '—')}</a></td>
        <td style="color:var(--text-dim);font-size:0.82rem;">${escapeHtml(t.cedula || '—')} / ${escapeHtml(String(t.experiencia || '0'))} años</td>
        <td style="color:var(--blue);font-size:0.82rem;">📍 ${escapeHtml(t.zona || 'General')}</td>
        <td style="color:var(--text-muted);font-size:0.8rem;max-width:200px;">${escapeHtml(espList)}</td>
        <td>${dispBadge}</td>
        <td>${estadoBadge}</td>
        <td>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.45rem;" onclick="window.verFichaTecnico('${t.id}')" title="Ver ficha completa">👁️</button>
            ${estado !== 'activo' ? `
              <button class="btn btn-sm" style="background:rgba(104,211,145,0.2);color:#68d391;border:1px solid rgba(104,211,145,0.4);font-size:0.75rem;padding:0.25rem 0.45rem;" onclick="window.cambiarEstadoTecnico('${t.id}', 'activo')">✅ Activar</button>
            ` : `
              <button class="btn btn-sm btn-ghost" style="color:#fc8181;font-size:0.75rem;padding:0.25rem 0.45rem;" onclick="window.cambiarEstadoTecnico('${t.id}', 'suspendido')">⏸ Pausar</button>
            `}
            <button class="btn btn-sm" style="background:var(--blue);color:white;font-size:0.75rem;padding:0.25rem 0.45rem;" onclick="window.gestionarClave('${sanitizeNum(t.whatsapp || t.cedula || '')}', '${escapeHtml(t.nombre || '')}')" title="Resetear contraseña">🔑</button>
            <a href="${waUrl}" target="_blank" class="btn btn-sm" style="background:#25D366;color:white;border:none;text-decoration:none;font-size:0.75rem;padding:0.25rem 0.45rem;">💬</a>
            <button class="btn btn-sm btn-danger" style="font-size:0.75rem;padding:0.25rem 0.45rem;" onclick="window.eliminarTecnico('${t.id}')" title="Eliminar técnico">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.cambiarEstadoTecnico = async function(tecnicoId, nuevoEstado) {
  try {
    await actualizarEstadoTecnico(tecnicoId, nuevoEstado);
    showToast(`✅ Estado de técnico actualizado a ${nuevoEstado}`, 'success');
  } catch (err) {
    showToast(`❌ Error: ${err.message}`, 'error');
  }
};

// ── Modal de Asignación de Técnico ────────────────────────────
let solicitudAsignandoId = null;
let tecnicoAsignadoActual = null;

window.abrirModalAsignar = function(solicitudId) {
  solicitudAsignandoId = solicitudId;
  const s = solicitudesList.find(x => x.id === solicitudId);
  if (!s) return;

  document.getElementById('asig-info-servicio').textContent = `Servicio: ${s.servicio}`;
  document.getElementById('asig-cliente-nombre').textContent  = s.nombre || '—';
  document.getElementById('asig-cliente-wa').textContent      = s.whatsapp || '—';
  document.getElementById('asig-cliente-zona').textContent    = s.direccion || s.zona || 'Caracas';
  document.getElementById('asig-cliente-urgencia').textContent = (s.urgencia || 'Normal').toUpperCase();

  // Poblar select de técnicos
  const select = document.getElementById('select-tecnico-asignar');
  if (select) {
    const activos = tecnicosList.filter(t => t.estado === 'activo' || !t.estado);
    select.innerHTML = '<option value="">-- Elige un técnico especialista --</option>' + activos.map(t => {
      const dispText = t.disponible !== false ? '🟢 Disp.' : '🔴 Ocupado';
      const espText  = Array.isArray(t.especialidades) ? t.especialidades.slice(0, 2).join(', ') : (t.especialidades || '');
      const isSelected = s.tecnicoAsignadoId === t.id ? 'selected' : '';
      return `<option value="${t.id}" ${isSelected}>⚡ ${t.nombre} [${espText}] - 📍 ${t.zona || 'General'} (${dispText})</option>`;
    }).join('');
  }

  const btnNotif = document.getElementById('btn-notificar-tecnico-wa');
  if (s.tecnicoAsignadoId && s.tecnicoWhatsApp) {
    tecnicoAsignadoActual = { id: s.tecnicoAsignadoId, nombre: s.tecnicoNombre, whatsapp: s.tecnicoWhatsApp };
    if (btnNotif) btnNotif.style.display = 'block';
  } else {
    tecnicoAsignadoActual = null;
    if (btnNotif) btnNotif.style.display = 'none';
  }

  document.getElementById('modal-asignar-tecnico')?.classList.add('open');
};

window.closeModalAsignar = function() {
  document.getElementById('modal-asignar-tecnico')?.classList.remove('open');
  solicitudAsignandoId = null;
};

window.confirmarAsignacion = async function() {
  if (!solicitudAsignandoId) return;
  const select = document.getElementById('select-tecnico-asignar');
  const tecnicoId = select.value;

  if (!tecnicoId) {
    showToast('Selecciona un técnico de la lista', 'error');
    return;
  }

  const tec = tecnicosList.find(t => t.id === tecnicoId);
  if (!tec) {
    showToast('Técnico no encontrado', 'error');
    return;
  }

  const btn = document.getElementById('btn-confirmar-asignacion');
  btn.disabled = true;
  btn.textContent = 'Asignando...';

  try {
    await asignarTecnicoASolicitud(solicitudAsignandoId, tec);
    tecnicoAsignadoActual = tec;
    
    showToast(`✅ Orden asignada exitosamente a ${tec.nombre}`, 'success');
    
    // Mostrar botón de notificar por WA
    const btnNotif = document.getElementById('btn-notificar-tecnico-wa');
    if (btnNotif) btnNotif.style.display = 'block';

    setTimeout(() => {
      window.closeModalAsignar();
    }, 1500);
  } catch (err) {
    console.error('Error asignando técnico:', err);
    showToast('❌ Error al asignar: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Asignar y Actualizar Solicitud';
  }
};

window.desasignarTecnico = async function() {
  if (!solicitudAsignandoId) return;
  if (!confirm('¿Deseas desasignar el técnico y dejar la solicitud en estado pendiente?')) return;

  try {
    await asignarTecnicoASolicitud(solicitudAsignandoId, null);
    showToast('Solicitud desasignada y dejada como libre', 'info');
    window.closeModalAsignar();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.notificarTecnicoWhatsApp = function() {
  if (!solicitudAsignandoId) return;
  const s = solicitudesList.find(x => x.id === solicitudAsignandoId);
  const tec = tecnicoAsignadoActual || tecnicosList.find(t => t.id === s?.tecnicoAsignadoId);

  if (!s || !tec || !tec.whatsapp) {
    showToast('No se encontró el WhatsApp del técnico', 'error');
    return;
  }

  const tecWa = sanitizeNum(tec.whatsapp);
  const mensaje = encodeURIComponent(
    `⚡ *NUEVA ORDEN ASIGNADA — Informáticos Venezuela*\n\n` +
    `Hola *${tec.nombre}*, se te ha asignado una orden de trabajo:\n\n` +
    `📋 *Servicio:* ${s.servicio}\n` +
    `👤 *Cliente:* ${s.nombre}\n` +
    `📱 *WhatsApp Cliente:* ${s.whatsapp}\n` +
    `📍 *Ubicación:* ${s.direccion || s.zona || 'Caracas'}\n` +
    `⚡ *Urgencia:* ${(s.urgencia || 'Normal').toUpperCase()}\n` +
    (s.descripcion ? `📝 *Detalles:* ${s.descripcion}\n\n` : '\n') +
    `👉 Entra a tu panel para ver y gestionar la orden:\n` +
    `https://informaticosvenezuela.com/tecnico.html`
  );

  window.open(`https://wa.me/${tecWa}?text=${mensaje}`, '_blank');
  showToast('WhatsApp abierto con la orden para el técnico', 'success');
};

