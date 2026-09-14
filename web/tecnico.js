// ============================================================
// tecnico.js — Lógica del Panel de Técnico
// Informáticos Venezuela | Red Profesional de Técnicos
// ============================================================

import {
  auth, db,
  collection, doc, onSnapshot, query, where,
  getDoc, getDocs, updateDoc, serverTimestamp,
  getTecnico, getTecnicoByWA, getTecnicoByCedula, guardarTecnico, actualizarDisponibilidadTecnico,
  actualizarEstadoPorTecnico, SUPER_ADMIN_DATA, isSuperAdminIdentifier
} from './firebase.js';

import {
  currentUser, isAdmin, isTecnico, userWhatsApp, userFoto, userCedula,
  openAuthModal, showToast
} from './auth.js';

let currentTecnico = null;
let assignedJobs   = [];
let currentFilter  = 'todos';
let unsubscribeJobs = null;

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

const ICONS_OPTIONS = [
  { icon: '💻', label: '💻 PC & Laptops (Windows)' },
  { icon: '🍏', label: '🍏 Apple & macOS (MacBook, iMac)' },
  { icon: '📡', label: '📡 Redes WiFi, Routers & Switching' },
  { icon: '📹', label: '📹 CCTV, Cámaras & NVR/DVR' },
  { icon: '🐧', label: '🐧 Linux & Servidores OpenSource' },
  { icon: '🖥️', label: '🖥️ Windows Server & Active Directory' },
  { icon: '☁️', label: '☁️ Cloud, VPS & Hosting (AWS/Azure)' },
  { icon: '🛡️', label: '🛡️ Ciberseguridad, Firewalls & VPN' },
  { icon: '🔌', label: '🔌 Cableado Estructurado & Fibra' },
  { icon: '🖨️', label: '🖨️ Impresoras, Escáneres & Hardware' },
  { icon: '⚡', label: '⚡ Energía, UPS & Inversores' },
  { icon: '💾', label: '💾 Backup, Respaldo & Recuperación' },
  { icon: '🌐', label: '🌐 Desarrollo Web & Tiendas Online' },
  { icon: '⚙️', label: '⚙️ Desarrollo de Software & APIs' },
  { icon: '🗄️', label: '🗄️ Bases de Datos (SQL/NoSQL)' },
  { icon: '📱', label: '📱 Celulares, Móvil, Android & iOS' },
  { icon: '📦', label: '📦 Virtualización (VMware, Proxmox, Docker)' },
  { icon: '🔒', label: '🔒 Antivirus, Seguridad & Malware' },
  { icon: '📞', label: '📞 Telefonía IP, PBX & VoIP' },
  { icon: '🔧', label: '🔧 Mantenimiento & Limpieza Física' },
  { icon: '🤖', label: '🤖 Inteligencia Artificial & Bots' },
  { icon: '💳', label: '💳 Sistemas POS & Facturación' },
  { icon: '🎮', label: '🎮 PC Gaming & Estaciones de Trabajo' },
  { icon: '🛠️', label: '🛠️ Soporte Técnico General / Help Desk' }
];

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
  return '🛠️';
}

function parseItem(itemStr) {
  if (!itemStr) return { icon: '🛠️', text: '' };
  const str = itemStr.trim();
  const emojiMatch = str.match(/^([\p{Extended_Pictographic}\u200d\uFE0F]+)\s*(.*)$/u);
  if (emojiMatch) {
    return { icon: emojiMatch[1], text: emojiMatch[2].trim() };
  }
  return { icon: detectIconForText(str), text: str };
}

// ── Inicialización ───────────────────────────────────────────
function bootTecnico() {
  initEvents();
  initSpecialtiesManager();
  checkAuthAndLoad();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootTecnico);
} else {
  bootTecnico();
}

function initEvents() {
  document.getElementById('btn-login-as-tec')?.addEventListener('click', () => {
    openAuthModal('tecnico', 'login', true);
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

  // Modal Update Avance
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

      const savedCedula = userCedula || localStorage.getItem('infovzla_user_cedula');
      const savedWA = userWhatsApp || localStorage.getItem('infovzla_wa_number');
      const isLocalAdmin = (typeof localStorage !== 'undefined' && (localStorage.getItem('infovzla_local_admin') === '1' || localStorage.getItem('infovzla_user_role') === 'admin'));
      const isSuper = admin || isLocalAdmin || isSuperAdminIdentifier(savedCedula) || isSuperAdminIdentifier(savedWA) || (user && (isSuperAdminIdentifier(user.uid) || user.email === 'tecnicouzcategui@gmail.com'));

      if (!user && !isSuper) {
        if (accessDenied) accessDenied.style.display = 'block';
        if (panelContent) panelContent.style.display = 'none';
        return;
      }

      // Si es el Super Administrador
      if (isSuper) {
        let tecData = null;
        try { tecData = await getTecnico('12832779'); } catch(_) {}
        if (!tecData && typeof localStorage !== 'undefined' && localStorage.getItem('infovzla_tecnico_data')) {
          try { tecData = JSON.parse(localStorage.getItem('infovzla_tecnico_data')); } catch(_) {}
        }
        currentTecnico = tecData || { ...SUPER_ADMIN_DATA };

        if (accessDenied) accessDenied.style.display = 'none';
        if (panelContent) panelContent.style.display = 'block';

        renderHeader();
        listenAssignedJobs(currentTecnico.id || '12832779');
        return;
      }

      // Si es técnico regular
      let tecData = null;
      if (user?.uid) {
        try { tecData = await getTecnico(user.uid); } catch(_) {}
      }
      if (!tecData && savedCedula) {
        try { tecData = await getTecnicoByCedula(savedCedula); } catch(_) {}
      }
      if (!tecData && savedWA) {
        try { tecData = await getTecnicoByWA(savedWA); } catch(_) {}
      }
      if (!tecData && typeof localStorage !== 'undefined' && localStorage.getItem('infovzla_tecnico_data')) {
        try { tecData = JSON.parse(localStorage.getItem('infovzla_tecnico_data')); } catch(_) {}
      }

      const isTecRole = tec || (typeof localStorage !== 'undefined' && localStorage.getItem('infovzla_user_role') === 'tecnico');
      if (!tecData && !isTecRole) {
        if (accessDenied) accessDenied.style.display = 'block';
        if (panelContent) panelContent.style.display = 'none';
        return;
      }

      // Usuario autorizado como técnico
      currentTecnico = tecData || {
        id: user?.uid || savedCedula || savedWA || 'tec',
        nombre: user?.displayName || localStorage.getItem('infovzla_user_nombre') || 'Técnico Especialista',
        whatsapp: savedWA || '—',
        cedula: savedCedula || '—',
        fotoPerfil: userFoto || localStorage.getItem('infovzla_user_foto') || null,
        zona: 'Todas las Zonas',
        especialidades: ['💻 Diagnóstico PC / Laptops', '📡 Redes WiFi', '📹 CCTV & Cámaras'],
        cualidades: ['Diagnóstico PC / Laptops', 'Redes WiFi', 'CCTV & Cámaras'],
        disponible: true,
        estado: 'activo'
      };

      if (accessDenied) accessDenied.style.display = 'none';
      if (panelContent) panelContent.style.display = 'block';

      renderHeader();
      listenAssignedJobs(currentTecnico.id || user?.uid);
    });
  });
}

// ── Render Header & Estado del Técnico ───────────────────────
function renderHeader() {
  if (!currentTecnico) return;

  const avatarEl = document.getElementById('tec-header-avatar');
  const nameEl   = document.getElementById('tec-header-name');
  const cedulaEl = document.getElementById('tec-header-cedula');
  const badgesEl = document.getElementById('tec-header-specs-badges');
  const waEl     = document.getElementById('tec-header-wa');
  const zonaEl   = document.getElementById('tec-header-zona');

  const foto = currentTecnico.fotoPerfil || userFoto || localStorage.getItem('infovzla_user_foto');
  const nombre = currentTecnico.nombre || 'Técnico Especialista';

  if (avatarEl) {
    if (foto) {
      avatarEl.innerHTML = `<img src="${foto}" alt="Foto Técnico" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    } else {
      avatarEl.textContent = nombre.charAt(0).toUpperCase();
    }
  }

  if (nameEl) nameEl.textContent = nombre;
  
  if (cedulaEl) {
    const ced = currentTecnico.cedula || localStorage.getItem('infovzla_user_cedula') || '—';
    cedulaEl.innerHTML = `🆔 <strong>Cédula:</strong> <span style="color:var(--text);">${ced}</span>`;
  }
  
  if (badgesEl) {
    let specs = [];
    if (Array.isArray(currentTecnico.especialidades) && currentTecnico.especialidades.length > 0) {
      specs = currentTecnico.especialidades;
    } else if (Array.isArray(currentTecnico.cualidades) && currentTecnico.cualidades.length > 0) {
      specs = currentTecnico.cualidades;
    } else {
      specs = ['💻 Soporte General', '📡 Redes'];
    }

    badgesEl.innerHTML = specs.map(item => {
      const parsed = parseItem(item);
      return `
        <span style="display:inline-flex; align-items:center; gap:0.35rem; background:rgba(246,173,85,0.15); border:1px solid rgba(246,173,85,0.4); color:#fbd38d; padding:0.25rem 0.65rem; border-radius:999px; font-size:0.75rem; font-weight:700;">
          <span style="font-size:0.95rem;">${parsed.icon}</span> ${parsed.text}
        </span>
      `;
    }).join('');
  }

  if (waEl)   waEl.textContent   = `📱 ${currentTecnico.whatsapp || 'Sin WhatsApp'}`;
  if (zonaEl) zonaEl.textContent = `📍 ${currentTecnico.zona || 'Caracas / General'}`;

  updateAvailabilityUI(currentTecnico.disponible !== false);
}

// ── Gestión Dinámica de Especialidades & Iconos del Técnico ───
function initSpecialtiesManager() {
  const modal          = document.getElementById('modal-manage-specialties');
  const btnOpen        = document.getElementById('btn-open-manage-specs');
  const btnClose       = document.getElementById('modal-manage-specs-close');
  const btnCancel      = document.getElementById('modal-manage-specs-cancel');
  const btnSave        = document.getElementById('modal-manage-specs-save');
  const btnAddRow      = document.getElementById('tec-manage-add-row');
  const rowsList       = document.getElementById('tec-manage-rows-list');
  const previewBadges  = document.getElementById('tec-manage-active-badges');

  function updateModalPreview() {
    if (!previewBadges || !rowsList) return;
    const rows = rowsList.querySelectorAll('.tec-manage-row');
    const items = [];
    rows.forEach(r => {
      const icon = r.querySelector('.tec-manage-icon-select')?.value || '🛠️';
      const text = r.querySelector('.tec-manage-text-input')?.value.trim();
      if (text) items.push({ icon, text });
    });

    if (items.length === 0) {
      previewBadges.innerHTML = `<span style="font-size:0.75rem; color:var(--text-dim); font-style:italic;">Agrega al menos una especialidad arriba.</span>`;
    } else {
      previewBadges.innerHTML = items.map(it => `
        <span style="display:inline-flex; align-items:center; gap:0.3rem; background:rgba(246,173,85,0.2); border:1px solid rgba(246,173,85,0.45); color:#fbd38d; padding:0.25rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:700;">
          <span style="font-size:0.95rem;">${it.icon}</span> ${it.text}
        </span>
      `).join('');
    }
  }

  function createRowElement(icon = '💻', text = '') {
    const row = document.createElement('div');
    row.className = 'tec-manage-row';
    row.style.cssText = 'display:flex; gap:0.45rem; align-items:center; background:rgba(0,0,0,0.2); padding:0.4rem; border-radius:8px; border:1px solid rgba(255,255,255,0.06);';
    const optionsHtml = ICONS_OPTIONS.map(opt => `<option value="${opt.icon}" ${opt.icon === icon ? 'selected' : ''}>${opt.label}</option>`).join('');
    row.innerHTML = `
      <select class="form-input tec-manage-icon-select" style="width:62px; padding:0.45rem 0.2rem; font-size:1.1rem; text-align:center; background:#1a202c; border:1px solid rgba(246,173,85,0.4); border-radius:6px; cursor:pointer;" title="Cambiar icono">
        ${optionsHtml}
      </select>
      <input type="text" class="form-input tec-manage-text-input" placeholder="Nombre de la especialidad o cualidad..." value="${text}" style="font-size:0.84rem; padding:0.5rem; flex:1;">
      <button type="button" class="btn-check-manage-row" style="background:#28a745; color:white; border:none; width:34px; height:34px; border-radius:6px; cursor:pointer; font-weight:800; font-size:1rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.2s;" title="Aceptar y pasar a la siguiente (Enter)">✓</button>
      <button type="button" class="btn-remove-manage-row" style="background:none; border:none; color:#fc8181; font-size:1.3rem; cursor:pointer; padding:0 6px;" title="Eliminar">&times;</button>
    `;

    const input = row.querySelector('.tec-manage-text-input');
    const select = row.querySelector('.tec-manage-icon-select');
    const checkBtn = row.querySelector('.btn-check-manage-row');

    input?.addEventListener('input', () => {
      if (!row.dataset.manualIcon) {
        const auto = detectIconForText(input.value);
        if (auto && select) select.value = auto;
      }
      updateModalPreview();
    });

    select?.addEventListener('change', () => {
      row.dataset.manualIcon = '1';
      updateModalPreview();
    });

    function acceptAndNext() {
      const val = input?.value.trim();
      if (val) {
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
        updateModalPreview();

        const allRows = Array.from(rowsList.querySelectorAll('.tec-manage-row'));
        const currIdx = allRows.indexOf(row);
        let nextEmpty = null;
        for (let i = currIdx + 1; i < allRows.length; i++) {
          const inp = allRows[i].querySelector('.tec-manage-text-input');
          if (inp && !inp.value.trim()) {
            nextEmpty = allRows[i];
            break;
          }
        }

        if (nextEmpty) {
          nextEmpty.querySelector('.tec-manage-text-input')?.focus();
        } else {
          const newRow = createRowElement('🛠️', '');
          rowsList.appendChild(newRow);
          newRow.querySelector('.tec-manage-text-input')?.focus();
          updateModalPreview();
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

    return row;
  }

  function openSpecialtiesModal() {
    if (!currentTecnico || !rowsList) return;
    rowsList.innerHTML = '';

    let items = [];
    if (Array.isArray(currentTecnico.especialidades) && currentTecnico.especialidades.length > 0) {
      items = currentTecnico.especialidades;
    } else if (Array.isArray(currentTecnico.cualidades) && currentTecnico.cualidades.length > 0) {
      items = currentTecnico.cualidades;
    }

    if (items.length === 0) {
      items = ['💻 Soporte PC y Laptops', '📡 Redes & WiFi'];
    }

    items.forEach(item => {
      const parsed = parseItem(item);
      const row = createRowElement(parsed.icon, parsed.text);
      rowsList.appendChild(row);
    });

    updateModalPreview();
    modal?.classList.add('open');
  }

  function closeSpecialtiesModal() {
    modal?.classList.remove('open');
  }

  btnOpen?.addEventListener('click', openSpecialtiesModal);
  btnClose?.addEventListener('click', closeSpecialtiesModal);
  btnCancel?.addEventListener('click', closeSpecialtiesModal);

  btnAddRow?.addEventListener('click', () => {
    if (!rowsList) return;
    const row = createRowElement('🛠️', '');
    rowsList.appendChild(row);
    row.querySelector('.tec-manage-text-input')?.focus();
    updateModalPreview();
  });

  rowsList?.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-manage-row')) {
      const rows = rowsList.querySelectorAll('.tec-manage-row');
      if (rows.length > 1) {
        e.target.closest('.tec-manage-row')?.remove();
      } else {
        const inp = rows[0].querySelector('.tec-manage-text-input');
        if (inp) inp.value = '';
      }
      updateModalPreview();
    }
  });

  btnSave?.addEventListener('click', async () => {
    if (!currentTecnico || !currentTecnico.id) return;

    const rows = rowsList.querySelectorAll('.tec-manage-row');
    const especialidades = [];
    const cualidades = [];

    rows.forEach(r => {
      const icon = r.querySelector('.tec-manage-icon-select')?.value || '🛠️';
      const text = r.querySelector('.tec-manage-text-input')?.value.trim();
      if (text) {
        especialidades.push(`${icon} ${text}`);
        cualidades.push(text);
      }
    });

    if (especialidades.length === 0) {
      showToast('Debes tener al menos una especialidad registrada.', 'error');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';

    try {
      if (currentTecnico.id !== 'local-admin') {
        await guardarTecnico(currentTecnico.id, {
          especialidades: especialidades,
          cualidades: cualidades
        });
      }

      currentTecnico.especialidades = especialidades;
      currentTecnico.cualidades = cualidades;

      renderHeader();
      closeSpecialtiesModal();
      showToast('✅ Especialidades e iconos actualizados exitosamente.', 'success');
    } catch (err) {
      console.error('Error guardando especialidades:', err);
      showToast('Error al guardar especialidades: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = '💾 Guardar Especialidades';
    }
  });
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

// ── Escuchar Solicitudes y Trabajos (Tiempo Real) ────────────
function listenAssignedJobs(tecnicoId) {
  if (unsubscribeJobs) unsubscribeJobs();

  // Escuchar toda la colección de solicitudes para que el administrador/técnico
  // pueda ver las solicitudes entrantes, tomarlas o trasladarlas
  const q = query(collection(db, 'solicitudes'));

  unsubscribeJobs = onSnapshot(q, (snapshot) => {
    assignedJobs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ordenar por fecha descendente
    assignedJobs.sort((a, b) => {
      const ta = a.timestamp?.seconds || (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0);
      const tb = b.timestamp?.seconds || (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0);
      return tb - ta;
    });

    updateKPIs();
    renderJobs();
  }, (err) => {
    console.error('Error en onSnapshot solicitudes:', err);
  });
}

// ── Actualizar KPIs ───────────────────────────────────────────
function updateKPIs() {
  const total       = assignedJobs.length;
  const sinAsignar  = assignedJobs.filter(j => !j.tecnicoAsignadoId || j.tecnicoAsignadoId === 'sin_asignar' || !j.estadoCaso || j.estadoCaso === 'pendiente').length;
  const enProgreso  = assignedJobs.filter(j => (j.estadoCaso === 'en_camino' || j.estadoCaso === 'en_progreso' || j.estadoCaso === 'tomado') && j.estadoCaso !== 'finalizado').length;
  const completados = assignedJobs.filter(j => j.estadoCaso === 'finalizado').length;

  const kTotal = document.getElementById('kpi-total');
  const kNuevos = document.getElementById('kpi-nuevos');
  const kProg = document.getElementById('kpi-progreso');
  const kComp = document.getElementById('kpi-completados');

  if (kTotal) kTotal.textContent = total;
  if (kNuevos) kNuevos.textContent = sinAsignar;
  if (kProg) kProg.textContent = enProgreso;
  if (kComp) kComp.textContent = completados;
}

// ── Renderizar Lista de Trabajos y Solicitudes ─────────────────
function renderJobs() {
  const container = document.getElementById('jobs-container');
  if (!container) return;

  const tecId = currentTecnico?.id || '12832779';
  const tecCed = currentTecnico?.cedula || 'V-12832779';

  let filtered = assignedJobs;
  if (currentFilter === 'sin_asignar') {
    filtered = assignedJobs.filter(j => !j.tecnicoAsignadoId || j.tecnicoAsignadoId === 'sin_asignar' || !j.estadoCaso || j.estadoCaso === 'pendiente');
  } else if (currentFilter === 'mis_ordenes') {
    filtered = assignedJobs.filter(j => j.tecnicoAsignadoId === tecId || j.tecnicoAsignadoCedula === tecCed || isSuperAdminIdentifier(j.tecnicoAsignadoId));
  } else if (currentFilter === 'progreso') {
    filtered = assignedJobs.filter(j => (j.estadoCaso === 'en_camino' || j.estadoCaso === 'en_progreso' || j.estadoCaso === 'tomado') && j.estadoCaso !== 'finalizado');
  } else if (currentFilter === 'finalizados') {
    filtered = assignedJobs.filter(j => j.estadoCaso === 'finalizado');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:3rem 1.5rem;">
        <div style="font-size:2.5rem; margin-bottom:0.75rem;">📭</div>
        <h3 style="font-size:1.1rem; margin-bottom:0.35rem;">No hay solicitudes en esta sección</h3>
        <p style="color:var(--text-muted); font-size:0.85rem;">Cuando los clientes soliciten soporte desde el portal, aparecerán listadas aquí.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(job => {
    const urgencia = (job.urgencia || 'normal').toLowerCase();
    const estado   = job.estadoCaso || (job.tecnicoAsignadoId ? 'tomado' : 'pendiente');
    const estaSinAsignar = !job.tecnicoAsignadoId || job.tecnicoAsignadoId === 'sin_asignar';

    let estadoLabel = estaSinAsignar ? '📥 Sin Asignar' : 'Asignado';
    let estadoClass = estaSinAsignar ? 'status-pill-pendiente' : 'status-pill-tomado';
    if (estado === 'en_camino')   { estadoLabel = '🚗 En Camino'; estadoClass = 'status-pill-en_camino'; }
    if (estado === 'en_progreso') { estadoLabel = '🔧 En Reparación'; estadoClass = 'status-pill-en_progreso'; }
    if (estado === 'finalizado')  { estadoLabel = '✅ Completado'; estadoClass = 'status-pill-finalizado'; }

    const fechaStr = job.timestamp?.toDate ? job.timestamp.toDate().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';
    const clienteWa = (job.whatsapp || '').replace(/[^0-9]/g, '');
    const waMsg = encodeURIComponent(`Hola ${job.nombre || ''}, te saluda ${currentTecnico.nombre || 'Luis Uzcátegui'} de Informáticos Venezuela sobre tu solicitud de ${job.servicio || 'servicio técnico'}.`);
    const waUrl = `https://wa.me/${clienteWa}?text=${waMsg}`;

    return `
      <div class="job-card ${urgencia}" style="margin-bottom:1.25rem;">
        <div class="job-card-header">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem; flex-wrap:wrap;">
              <h3 style="font-size:1.1rem; font-weight:800; margin:0; color:var(--text);">${escapeHtml(job.servicio || 'Servicio Técnico')}</h3>
              <span class="job-status-pill ${estadoClass}">${estadoLabel}</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-dim);">Ticket: <code style="color:var(--blue);font-weight:700;">${escapeHtml(job.correlativo || ('#' + job.id.substring(0, 8)))}</code> • ${fechaStr}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${urgencia === 'alta' ? 'badge-danger' : (urgencia === 'media' ? 'badge-warning' : 'badge-success')}" style="font-size:0.72rem; text-transform:uppercase;">
              ⚡ Urgencia: ${escapeHtml(job.urgencia || 'Normal')}
            </span>
          </div>
        </div>

        <div class="job-details-grid" style="margin-bottom:1rem;">
          <div>
            <div style="font-weight:700; color:var(--text); margin-bottom:0.2rem;">👤 Cliente Solicitante:</div>
            <div><strong>${escapeHtml(job.nombre || 'Cliente')}</strong></div>
            <div style="font-size:0.8rem; color:var(--blue); margin-top:0.15rem;">📱 ${escapeHtml(job.whatsapp || '—')}</div>
          </div>

          <div>
            <div style="font-weight:700; color:var(--text); margin-bottom:0.2rem;">📍 Ubicación / Zona:</div>
            <div>${escapeHtml(job.direccion || job.zona || 'Caracas')}</div>
          </div>

          <div>
            <div style="font-weight:700; color:var(--text); margin-bottom:0.2rem;">💰 Presupuesto Base:</div>
            <div style="font-weight:700; color:var(--green);">${job.precio ? `$${escapeHtml(String(job.precio))} USD` : 'A convenir'}</div>
          </div>
        </div>

        ${job.descripcion ? `
          <div style="background:rgba(0,0,0,0.3); border-left:3px solid var(--blue); padding:0.75rem 1rem; border-radius:0.5rem; font-size:0.82rem; color:var(--text-muted); margin-bottom:1rem;">
            <strong>📝 Falla / Requerimiento reportado:</strong><br>${escapeHtml(job.descripcion)}
          </div>
        ` : ''}

        ${job.notaTecnica ? `
          <div style="background:rgba(246,173,85,0.08); border-left:3px solid #f6ad55; padding:0.75rem 1rem; border-radius:0.5rem; font-size:0.82rem; color:#fbd38d; margin-bottom:1rem;">
            <strong>🔧 Última nota técnica / avance:</strong><br>${escapeHtml(job.notaTecnica)}
          </div>
        ` : ''}

        <!-- Panel de Asignación / Control del Ticket -->
        ${estaSinAsignar ? `
          <div style="background:rgba(246,173,85,0.12); border:1px solid rgba(246,173,85,0.35); padding:0.85rem; border-radius:8px; margin-bottom:1rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.6rem;">
            <div>
              <div style="font-weight:700; color:#f6ad55; font-size:0.88rem;">⚡ Solicitud Abierta en Espera de Atención</div>
              <div style="font-size:0.78rem; color:var(--text-muted);">Puedes tomar esta orden para atenderla tú mismo o asignársela a otro técnico.</div>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-sm btn-tomar-solicitud" data-id="${job.id}" style="background:#28a745; color:white; font-weight:800; border:none; padding:0.45rem 0.95rem; border-radius:6px; cursor:pointer;">
                ⚡ Tomar Solicitud
              </button>
              <button type="button" class="btn btn-sm btn-abrir-asignar" data-id="${job.id}" data-ticket="${escapeHtml(job.correlativo || job.servicio || job.id)}" style="background:#f6ad55; color:#1a202c; font-weight:800; border:none; padding:0.45rem 0.95rem; border-radius:6px; cursor:pointer;">
                🔄 Trasladar a Técnico
              </button>
            </div>
          </div>
        ` : `
          <div style="background:rgba(99,179,237,0.08); border:1px solid rgba(99,179,237,0.25); padding:0.65rem 0.85rem; border-radius:8px; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div style="font-size:0.82rem; color:var(--text);">
              👤 Técnico Asignado: <strong style="color:var(--accent);">${escapeHtml(job.tecnicoAsignadoNombre || 'Luis Uzcátegui')}</strong>
              ${job.tecnicoAsignadoWA ? ` • 📱 <a href="https://wa.me/${job.tecnicoAsignadoWA.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--accent); text-decoration:underline;">${escapeHtml(job.tecnicoAsignadoWA)}</a>` : ''}
            </div>
            <button type="button" class="btn btn-sm btn-abrir-asignar" data-id="${job.id}" data-ticket="${escapeHtml(job.correlativo || job.servicio || job.id)}" style="background:rgba(246,173,85,0.2); border:1px solid rgba(246,173,85,0.4); color:#f6ad55; font-size:0.75rem; padding:0.25rem 0.65rem; border-radius:6px; cursor:pointer;">
              🔄 Reasignar a otro Técnico
            </button>
          </div>
        `}

        <div class="job-actions-row" style="margin-top:0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            ${clienteWa ? `
              <a href="${waUrl}" target="_blank" class="btn btn-sm" style="background:#25D366; color:white; border:none; text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:0.35rem; padding:0.45rem 0.85rem; border-radius:6px;">
                💬 WhatsApp Cliente
              </a>
            ` : ''}
            
            <button type="button" class="btn btn-secondary btn-sm btn-update-status" data-id="${job.id}" data-estado="${estado}" data-nota="${encodeURIComponent(job.notaTecnica || '')}" data-title="${job.servicio || 'Servicio'}">
              📝 Registrar Avance / Reporte
            </button>
          </div>

          <!-- Acciones Rápidas de Estado -->
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${estado !== 'en_camino' && estado !== 'finalizado' ? `
              <button type="button" class="btn btn-sm btn-quick-status" data-id="${job.id}" data-estado="en_camino" style="background:rgba(246,173,85,0.15); border:1px solid rgba(246,173,85,0.3); color:#f6ad55; font-size:0.75rem; padding:0.35rem 0.65rem; border-radius:6px; cursor:pointer;">
                🚗 En camino
              </button>
            ` : ''}
            
            ${estado !== 'en_progreso' && estado !== 'finalizado' ? `
              <button type="button" class="btn btn-sm btn-quick-status" data-id="${job.id}" data-estado="en_progreso" style="background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.3); color:#a855f7; font-size:0.75rem; padding:0.35rem 0.65rem; border-radius:6px; cursor:pointer;">
                🔧 Reparando
              </button>
            ` : ''}

            ${estado !== 'finalizado' ? `
              <button type="button" class="btn btn-sm btn-quick-status" data-id="${job.id}" data-estado="finalizado" style="background:rgba(104,211,145,0.15); border:1px solid rgba(104,211,145,0.3); color:#68d391; font-size:0.75rem; font-weight:700; padding:0.35rem 0.65rem; border-radius:6px; cursor:pointer;">
                ✅ Finalizar
              </button>
            ` : ''}
          </div>
        </div>

      </div>
    `;
  }).join('');

  // ── Listeners para Tomar Solicitud y Asignar a Técnico ────────
  container.querySelectorAll('.btn-tomar-solicitud').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      await tomarSolicitud(id);
    });
  });

  container.querySelectorAll('.btn-abrir-asignar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const ticket = e.currentTarget.dataset.ticket;
      abrirModalAsignar(id, ticket);
    });
  });

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

// ── Tomar Solicitud (Asignación Directa al Administrador/Técnico) ──
async function tomarSolicitud(jobId) {
  try {
    const tecNombre = currentTecnico?.nombre || 'Luis Uzcátegui';
    const tecId     = currentTecnico?.id || '12832779';
    const tecWA     = currentTecnico?.whatsapp || '04242964339';
    const tecCed    = currentTecnico?.cedula || 'V-12832779';

    await updateDoc(doc(db, 'solicitudes', jobId), {
      tecnicoAsignadoId: tecId,
      tecnicoAsignadoNombre: tecNombre,
      tecnicoAsignadoWA: tecWA,
      tecnicoAsignadoCedula: tecCed,
      estadoCaso: 'tomado',
      estado: 'en_proceso',
      tomadoEn: serverTimestamp()
    });

    showToast(`✅ ¡Has tomado la solicitud! Asignada directamente a ${tecNombre}.`, 'success');
  } catch (err) {
    console.error('Error tomando solicitud:', err);
    showToast('Error al tomar solicitud: ' + err.message, 'error');
  }
}

// ── Modal de Asignación / Traslado a otro Técnico ─────────────
let assignJobId = null;

async function abrirModalAsignar(jobId, ticketTitle) {
  assignJobId = jobId;
  const modal    = document.getElementById('modal-assign-tecnico');
  const infoEl   = document.getElementById('modal-assign-ticket-info');
  const select   = document.getElementById('modal-select-tecnico');
  const preview  = document.getElementById('modal-tecnico-preview');

  if (infoEl) infoEl.textContent = `Ticket: ${ticketTitle}`;
  if (preview) preview.style.display = 'none';

  select.innerHTML = '<option value="">Cargando técnicos disponibles...</option>';
  modal?.classList.add('open');

  try {
    const snap = await getDocs(collection(db, 'tecnicos'));
    let tecs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Asegurar que el Super Administrador Luis Uzcátegui esté en la lista
    const hasLuis = tecs.some(t => isSuperAdminIdentifier(t.id) || isSuperAdminIdentifier(t.cedula) || isSuperAdminIdentifier(t.email));
    if (!hasLuis) {
      tecs.unshift({
        id: '12832779',
        nombre: 'Luis Uzcátegui (Super Admin)',
        whatsapp: '04242964339',
        cedula: 'V-12832779',
        zona: 'Caracas / Toda Venezuela',
        profesion: 'Ingeniero / Administrador Principal Help Desk'
      });
    }

    select.innerHTML = '<option value="">-- Selecciona el técnico de la lista --</option>' +
      tecs.map(t => `<option value="${t.id}" data-nombre="${escapeHtml(t.nombre || 'Técnico IT')}" data-wa="${escapeHtml(t.whatsapp || '')}" data-cedula="${escapeHtml(t.cedula || '')}" data-zona="${escapeHtml(t.zona || 'Caracas')}">${escapeHtml(t.nombre || 'Técnico')} (${t.cedula || 'V-—'}) • ${escapeHtml(t.zona || 'Caracas')}</option>`).join('');

    select.onchange = () => {
      const selected = select.options[select.selectedIndex];
      if (selected && selected.value) {
        if (preview) {
          preview.style.display = 'block';
          preview.innerHTML = `
            <div style="font-weight:700; color:#f6ad55; margin-bottom:0.25rem;">Técnico seleccionado:</div>
            <div><strong>${selected.dataset.nombre}</strong> (Cédula: ${selected.dataset.cedula || '—'})</div>
            <div style="color:var(--text-muted); margin-top:0.2rem;">📱 WhatsApp: ${selected.dataset.wa || '—'} • 📍 Zona: ${selected.dataset.zona || 'Caracas'}</div>
          `;
        }
      } else {
        if (preview) preview.style.display = 'none';
      }
    };
  } catch (err) {
    console.error('Error cargando técnicos:', err);
    select.innerHTML = '<option value="">Error al cargar técnicos de la red.</option>';
  }
}

document.getElementById('modal-assign-close')?.addEventListener('click', () => {
  document.getElementById('modal-assign-tecnico')?.classList.remove('open');
  assignJobId = null;
});

document.getElementById('modal-assign-cancel')?.addEventListener('click', () => {
  document.getElementById('modal-assign-tecnico')?.classList.remove('open');
  assignJobId = null;
});

document.getElementById('modal-assign-confirm')?.addEventListener('click', async () => {
  if (!assignJobId) return;
  const select = document.getElementById('modal-select-tecnico');
  const selected = select?.options[select.selectedIndex];
  if (!selected || !selected.value) {
    showToast('Selecciona un técnico de la lista para continuar.', 'error');
    return;
  }

  const btn = document.getElementById('modal-assign-confirm');
  btn.disabled = true;
  btn.textContent = 'Asignando...';

  try {
    await updateDoc(doc(db, 'solicitudes', assignJobId), {
      tecnicoAsignadoId: selected.value,
      tecnicoAsignadoNombre: selected.dataset.nombre,
      tecnicoAsignadoWA: selected.dataset.wa || '',
      tecnicoAsignadoCedula: selected.dataset.cedula || '',
      estadoCaso: 'tomado',
      estado: 'en_proceso',
      asignadoEn: serverTimestamp()
    });

    showToast(`✅ ¡Solicitud asignada con éxito a ${selected.dataset.nombre}!`, 'success');
    document.getElementById('modal-assign-tecnico')?.classList.remove('open');
    assignJobId = null;
  } catch (err) {
    console.error('Error asignando técnico:', err);
    showToast('Error al asignar la orden: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Confirmar Asignación';
  }
});

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
