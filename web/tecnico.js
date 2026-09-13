// ============================================================
// tecnico.js — Lógica del Panel de Técnico
// InformaticaVES | Red Profesional de Técnicos
// ============================================================

import {
  auth, db,
  collection, doc, onSnapshot, query, where,
  getDoc, getDocs, updateDoc, serverTimestamp,
  getTecnico, getTecnicoByWA, actualizarDisponibilidadTecnico,
  actualizarEstadoPorTecnico
} from './firebase.js';

import {
  currentUser, isAdmin, isTecnico, userWhatsApp,
  openAuthModal, showToast
} from './auth.js';

let currentTecnico = null;
let assignedJobs   = [];
let currentFilter  = 'todos';
let unsubscribeJobs = null;

// ── Inicialización ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  checkAuthAndLoad();
});

function initEvents() {
  document.getElementById('btn-login-as-tec')?.addEventListener('click', () => {
    openAuthModal('tecnico');
  });

  document.getElementById('btn-toggle-availability')?.addEventListener('click', toggleAvailability);

  // Filtros
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentFilter = e.currentTarget.dataset.filter;
      renderJobs();
    });
  });

  // Modal Update
  document.getElementById('modal-update-close')?.addEventListener('click', closeUpdateModal);
  document.getElementById('modal-update-cancel')?.addEventListener('click', closeUpdateModal);
  document.getElementById('modal-update-save')?.addEventListener('click', saveJobStatus);
}

// ── Verificación de Autenticación ─────────────────────────────
async function checkAuthAndLoad() {
  import('./auth.js').then(AuthModule => {
    AuthModule.onAuthChange(async (user, admin, tec) => {
      const accessDenied = document.getElementById('tec-access-denied');
      const panelContent = document.getElementById('tec-panel-content');

      if (!user) {
        if (accessDenied) accessDenied.style.display = 'block';
        if (panelContent) panelContent.style.display = 'none';
        return;
      }

      // Si es admin o técnico
      let tecData = null;
      if (user.uid) {
        tecData = await getTecnico(user.uid);
      }
      if (!tecData && userWhatsApp) {
        tecData = await getTecnicoByWA(userWhatsApp);
      }

      if (!tecData && !admin) {
        if (accessDenied) accessDenied.style.display = 'block';
        if (panelContent) panelContent.style.display = 'none';
        return;
      }

      // Usuario autorizado
      currentTecnico = tecData || {
        id: user.uid,
        nombre: user.displayName || 'Administrador Técnico',
        whatsapp: userWhatsApp || '—',
        zona: 'Todas las Zonas',
        especialidades: ['Soporte Integral', 'Redes', 'CCTV'],
        disponible: true,
        estado: 'activo'
      };

      if (accessDenied) accessDenied.style.display = 'none';
      if (panelContent) panelContent.style.display = 'block';

      renderHeader();
      listenAssignedJobs(currentTecnico.id || user.uid);
    });
  });
}

// ── Render Header & Estado del Técnico ───────────────────────
function renderHeader() {
  if (!currentTecnico) return;

  const avatarEl = document.getElementById('tec-header-avatar');
  const nameEl   = document.getElementById('tec-header-name');
  const specsEl  = document.getElementById('tec-header-specs');
  const waEl     = document.getElementById('tec-header-wa');
  const zonaEl   = document.getElementById('tec-header-zona');

  if (avatarEl) avatarEl.textContent = (currentTecnico.nombre || 'T').charAt(0).toUpperCase();
  if (nameEl)   nameEl.textContent   = currentTecnico.nombre || 'Técnico Especialista';
  
  if (specsEl) {
    const esp = Array.isArray(currentTecnico.especialidades) ? currentTecnico.especialidades.join(', ') : (currentTecnico.especialidades || 'Soporte General');
    specsEl.textContent = `🛠️ ${esp}`;
  }

  if (waEl)   waEl.textContent   = `📱 ${currentTecnico.whatsapp || 'Sin WhatsApp'}`;
  if (zonaEl) zonaEl.textContent = `📍 ${currentTecnico.zona || 'Caracas / General'}`;

  updateAvailabilityUI(currentTecnico.disponible !== false);
}

// ── Toggle Disponibilidad ─────────────────────────────────────
async function toggleAvailability() {
  if (!currentTecnico) return;
  const newStatus = !(currentTecnico.disponible !== false);
  currentTecnico.disponible = newStatus;
  updateAvailabilityUI(newStatus);

  try {
    if (currentTecnico.id && currentTecnico.id !== 'local-admin') {
      await actualizarDisponibilidadTecnico(currentTecnico.id, newStatus);
    }
    showToast(newStatus ? '🟢 Ahora estás Disponible para recibir órdenes' : '🔴 Estado cambiado a Ocupado / En pausa', 'info');
  } catch (err) {
    console.error('Error actualizando disponibilidad:', err);
    showToast('Error al actualizar disponibilidad', 'error');
  }
}

function updateAvailabilityUI(disponible) {
  const dot  = document.getElementById('avail-dot');
  const text = document.getElementById('avail-text');
  if (!dot || !text) return;

  if (disponible) {
    dot.style.background = '#48bb78';
    text.style.color     = '#48bb78';
    text.textContent     = '🟢 Disponible para recibir trabajos';
  } else {
    dot.style.background = '#e53e3e';
    text.style.color     = '#fc8181';
    text.textContent     = '🔴 En Pausa / Ocupado';
  }
}

// ── Escuchar Trabajos Asignados (Tiempo Real) ─────────────────
function listenAssignedJobs(tecnicoId) {
  if (unsubscribeJobs) unsubscribeJobs();

  const q = query(
    collection(db, 'solicitudes'),
    where('tecnicoAsignadoId', '==', tecnicoId)
  );

  unsubscribeJobs = onSnapshot(q, (snapshot) => {
    assignedJobs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ordenar por fecha descendente
    assignedJobs.sort((a, b) => {
      const ta = a.timestamp?.seconds || 0;
      const tb = b.timestamp?.seconds || 0;
      return tb - ta;
    });

    updateKPIs();
    renderJobs();
  }, (err) => {
    console.error('Error en onSnapshot solicitudes asignadas:', err);
  });
}

// ── Actualizar KPIs ───────────────────────────────────────────
function updateKPIs() {
  const total       = assignedJobs.length;
  const nuevos      = assignedJobs.filter(j => !j.estadoCaso || j.estadoCaso === 'pendiente' || j.estadoCaso === 'tomado').length;
  const enProgreso  = assignedJobs.filter(j => j.estadoCaso === 'en_camino' || j.estadoCaso === 'en_progreso').length;
  const completados = assignedJobs.filter(j => j.estadoCaso === 'finalizado').length;

  document.getElementById('kpi-total').textContent       = total;
  document.getElementById('kpi-nuevos').textContent      = nuevos;
  document.getElementById('kpi-progreso').textContent    = enProgreso;
  document.getElementById('kpi-completados').textContent = completados;
}

// ── Renderizar Lista de Trabajos ──────────────────────────────
function renderJobs() {
  const container = document.getElementById('jobs-container');
  if (!container) return;

  let filtered = assignedJobs;
  if (currentFilter === 'pendientes') {
    filtered = assignedJobs.filter(j => !j.estadoCaso || j.estadoCaso === 'pendiente' || j.estadoCaso === 'tomado');
  } else if (currentFilter === 'progreso') {
    filtered = assignedJobs.filter(j => j.estadoCaso === 'en_camino' || j.estadoCaso === 'en_progreso');
  } else if (currentFilter === 'finalizados') {
    filtered = assignedJobs.filter(j => j.estadoCaso === 'finalizado');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:3rem 1.5rem;">
        <div style="font-size:2.5rem; margin-bottom:0.75rem;">📭</div>
        <h3 style="font-size:1.1rem; margin-bottom:0.35rem;">No hay órdenes en esta sección</h3>
        <p style="color:var(--text-muted); font-size:0.85rem;">Cuando el administrador te asigne un nuevo trabajo, aparecerá aquí inmediatamente.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(job => {
    const urgencia = (job.urgencia || 'normal').toLowerCase();
    const estado   = job.estadoCaso || 'tomado';

    let estadoLabel = 'Asignado';
    let estadoClass = 'status-pill-tomado';
    if (estado === 'en_camino')   { estadoLabel = '🚗 En Camino'; estadoClass = 'status-pill-en_camino'; }
    if (estado === 'en_progreso') { estadoLabel = '🔧 En Reparación'; estadoClass = 'status-pill-en_progreso'; }
    if (estado === 'finalizado')  { estadoLabel = '✅ Completado'; estadoClass = 'status-pill-finalizado'; }

    const fechaStr = job.timestamp?.toDate ? job.timestamp.toDate().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';
    
    // Preparar mensaje de WhatsApp para el cliente
    const clienteWa = (job.whatsapp || '').replace(/[^0-9]/g, '');
    const waMsg = encodeURIComponent(`Hola ${job.nombre || ''}, te saluda ${currentTecnico.nombre}, el técnico asignado a tu solicitud de ${job.servicio || 'servicio técnico'} en InformaticaVES.`);
    const waUrl = `https://wa.me/${clienteWa}?text=${waMsg}`;

    return `
      <div class="job-card ${urgencia}">
        <div class="job-card-header">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
              <h3 style="font-size:1.05rem; font-weight:700; margin:0; color:var(--text);">${job.servicio || 'Servicio Técnico'}</h3>
              <span class="job-status-pill ${estadoClass}">${estadoLabel}</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-dim);">Orden ID: <code style="color:var(--blue);">${job.id.substring(0, 8)}</code> • ${fechaStr}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${urgencia === 'alta' ? 'badge-danger' : (urgencia === 'media' ? 'badge-warning' : 'badge-success')}" style="font-size:0.72rem; text-transform:uppercase;">
              ⚡ Urgencia: ${job.urgencia || 'Normal'}
            </span>
          </div>
        </div>

        <div class="job-details-grid">
          <div>
            <div style="font-weight:700; color:var(--text); margin-bottom:0.2rem;">👤 Cliente:</div>
            <div>${job.nombre || 'Cliente'}</div>
            <div style="font-size:0.8rem; color:var(--blue); margin-top:0.15rem;">📱 ${job.whatsapp || '—'}</div>
          </div>

          <div>
            <div style="font-weight:700; color:var(--text); margin-bottom:0.2rem;">📍 Ubicación / Zona:</div>
            <div>${job.direccion || job.zona || 'Caracas'}</div>
          </div>

          <div>
            <div style="font-weight:700; color:var(--text); margin-bottom:0.2rem;">💰 Presupuesto Estimado:</div>
            <div style="font-weight:700; color:var(--green);">${job.precio ? `$${job.precio} USD` : 'A convenir'}</div>
          </div>
        </div>

        ${job.descripcion ? `
          <div style="background:rgba(0,0,0,0.3); border-left:3px solid var(--blue); padding:0.75rem 1rem; border-radius:0.5rem; font-size:0.82rem; color:var(--text-muted); margin-bottom:1rem;">
            <strong>📝 Falla / Requerimiento:</strong><br>${job.descripcion}
          </div>
        ` : ''}

        ${job.notaTecnica ? `
          <div style="background:rgba(246,173,85,0.08); border-left:3px solid #f6ad55; padding:0.75rem 1rem; border-radius:0.5rem; font-size:0.82rem; color:#fbd38d; margin-bottom:1rem;">
            <strong>🔧 Tu última nota técnica:</strong><br>${job.notaTecnica}
          </div>
        ` : ''}

        <div class="job-actions-row">
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            ${clienteWa ? `
              <a href="${waUrl}" target="_blank" class="btn btn-sm" style="background:#25D366; color:white; border:none; text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:0.35rem;">
                💬 WhatsApp Cliente
              </a>
            ` : ''}
            
            <button class="btn btn-secondary btn-sm btn-update-status" data-id="${job.id}" data-estado="${estado}" data-nota="${encodeURIComponent(job.notaTecnica || '')}" data-title="${job.servicio || 'Servicio'}">
              🔄 Actualizar Avance
            </button>
          </div>

          <!-- Acciones Rápidas con 1 clic -->
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${estado !== 'en_camino' && estado !== 'finalizado' ? `
              <button class="btn btn-sm btn-quick-status" data-id="${job.id}" data-estado="en_camino" style="background:rgba(246,173,85,0.15); border:1px solid rgba(246,173,85,0.3); color:#f6ad55; font-size:0.75rem;">
                🚗 En camino
              </button>
            ` : ''}
            
            ${estado !== 'en_progreso' && estado !== 'finalizado' ? `
              <button class="btn btn-sm btn-quick-status" data-id="${job.id}" data-estado="en_progreso" style="background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.3); color:#a855f7; font-size:0.75rem;">
                🔧 Reparando
              </button>
            ` : ''}

            ${estado !== 'finalizado' ? `
              <button class="btn btn-sm btn-quick-status" data-id="${job.id}" data-estado="finalizado" style="background:rgba(104,211,145,0.15); border:1px solid rgba(104,211,145,0.3); color:#68d391; font-size:0.75rem; font-weight:700;">
                ✅ Finalizar
              </button>
            ` : ''}
          </div>
        </div>

      </div>
    `;
  }).join('');

  // Eventos de botones
  container.querySelectorAll('.btn-update-status').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id     = e.currentTarget.dataset.id;
      const estado = e.currentTarget.dataset.estado;
      const nota   = decodeURIComponent(e.currentTarget.dataset.nota || '');
      const title  = e.currentTarget.dataset.title;
      openUpdateModal(id, estado, nota, title);
    });
  });

  container.querySelectorAll('.btn-quick-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id     = e.currentTarget.dataset.id;
      const estado = e.currentTarget.dataset.estado;
      await quickUpdateStatus(id, estado);
    });
  });
}

// ── Modal Actualizar Estado ───────────────────────────────────
let activeJobId = null;

function openUpdateModal(id, estado, nota, title) {
  activeJobId = id;
  document.getElementById('modal-update-solicitud-title').textContent = title;
  document.getElementById('modal-select-estado').value = estado;
  document.getElementById('modal-nota-tecnica').value  = nota || '';
  document.getElementById('modal-update-job')?.classList.add('open');
}

function closeUpdateModal() {
  document.getElementById('modal-update-job')?.classList.remove('open');
  activeJobId = null;
}

async function saveJobStatus() {
  if (!activeJobId) return;
  const nuevoEstado = document.getElementById('modal-select-estado').value;
  const notaTecnica = document.getElementById('modal-nota-tecnica').value.trim();

  const btn = document.getElementById('modal-update-save');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await actualizarEstadoPorTecnico(activeJobId, nuevoEstado, notaTecnica);
    showToast('✅ Estado y reporte actualizados con éxito', 'success');
    closeUpdateModal();
  } catch (err) {
    console.error('Error guardando estado:', err);
    showToast('Error al guardar estado: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Guardar Cambio';
  }
}

async function quickUpdateStatus(id, nuevoEstado) {
  try {
    await actualizarEstadoPorTecnico(id, nuevoEstado);
    const labels = {
      'en_camino': '🚗 Notificado: En camino al lugar',
      'en_progreso': '🔧 En progreso de diagnóstico y reparación',
      'finalizado': '✅ ¡Excelente! Trabajo marcado como finalizado'
    };
    showToast(labels[nuevoEstado] || 'Estado actualizado', 'success');
  } catch (err) {
    console.error('Error en quick update:', err);
    showToast('Error al actualizar estado', 'error');
  }
}
