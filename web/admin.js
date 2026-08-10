// ============================================================
// admin.js — Panel Administrador (Solo tecnicouzcategui@gmail.com)
// Flujo: Borrador → Vista Previa → Publicado
// InformaticaVES | El Técnico Luis
// ============================================================

import {
  db, auth, collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, where,
  getTodosServicios, COLS
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
    initTabs();
    cargarServicios();
    cargarSolicitudes();
    cargarFAQ();
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
    const snap = await getDocs(query(collection(db, COLS.servicios), orderBy('categoria'), orderBy('nombre')));
    servicios  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTablaServicios();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--red);padding:2rem">Error: ${err.message}</td></tr>`;
  }
}

function renderTablaServicios() {
  const tbody = document.getElementById('servicios-tbody');
  if (!tbody) return;

  if (!servicios.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem;color:var(--text-dim)">No hay servicios registrados.</td></tr>';
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
async function cargarSolicitudes() {
  const tbody = document.getElementById('solicitudes-tbody');
  if (!tbody) return;

  const q = query(collection(db, COLS.solicitudes), orderBy('timestamp', 'desc'));

  onSnapshot(q, snap => {
    const solicitudes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!solicitudes.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-dim)">No hay solicitudes aún.</td></tr>';
      return;
    }

    tbody.innerHTML = solicitudes.map(s => {
      const fecha = s.timestamp?.toDate?.()?.toLocaleString('es-VE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }) || '—';
      const urgEmoji = s.urgencia === 'alta' ? '🔴' : s.urgencia === 'media' ? '🟡' : '🟢';
      return `
        <tr style="${!s.leida ? 'background:rgba(99,179,237,0.04)' : ''}">
          <td>${urgEmoji}</td>
          <td style="color:var(--text);font-weight:${s.leida ? '400' : '700'}">${s.nombre}</td>
          <td><a href="https://wa.me/${sanitizeNum(s.whatsapp)}" target="_blank" style="color:var(--green)">${s.whatsapp}</a></td>
          <td style="color:var(--text-muted)">${s.servicio}</td>
          <td style="color:var(--text-dim);font-size:0.8rem">${fecha}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="verDetalles('${s.id}')">👁 Ver</button>
            ${!s.leida ? `<button class="btn btn-sm btn-ghost" onclick="marcarLeida('${s.id}')">✓ Leída</button>` : ''}
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

window.verDetalles = function(id) {
  showToast('ℹ️ Función de detalle en desarrollo', 'info');
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
    const snap = await getDocs(query(collection(db, COLS.faq), orderBy('orden')));
    faqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
