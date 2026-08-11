// ============================================================
// admin-notifications.js — Monitor global de solicitudes
// Se activa en CUALQUIER página cuando el admin está logueado
// SIN dependencias circulares (no importa auth.js)
// InformaticaVES | El Técnico Luis
// ============================================================

import { db, collection, query, orderBy, onSnapshot } from './firebase.js';

const COLS_SOLICITUDES = 'ives_solicitudes';
const NOTIF_CHANNEL_ID = 'ives_solicitudes_high';

let _unsubscribe   = null;
let _seenIds       = new Set();
let _isFirstLoad   = true;
let _audioCtx      = null;

// ── API pública ───────────────────────────────────────────────

let _snapCount = 0;
let _addedCount = 0;
let _modCount = 0;

function _updateIndicator() {
  const ind = document.getElementById('admin-monitor-indicator');
  if (ind) {
    ind.innerHTML = `🟢 Monitor (Snaps: ${_snapCount} | Ids: ${_seenIds.size} | +${_addedCount} | ~${_modCount}) <span style="text-decoration:underline;margin-left:5px;">(Probar)</span>`;
  }
}

export function initGlobalAdminNotifications() {
  if (_unsubscribe) return; // ya está escuchando

  _seenIds.clear();
  _isFirstLoad = true;
  _snapCount = 0;
  _addedCount = 0;
  _modCount = 0;

  console.log('[AdminNotif] Iniciando monitor global de solicitudes...');

  // Escuchar toda la colección sin orderBy para evitar que Firebase ignore
  // las escrituras locales que aún no tienen serverTimestamp() resuelto.
  const q = query(collection(db, COLS_SOLICITUDES));

  _unsubscribe = onSnapshot(q, snap => {
    _snapCount++;
    if (_isFirstLoad) {
      // Registrar todas las existentes para no alertar de las viejas
      snap.docs.forEach(d => _seenIds.add(d.id));
      _isFirstLoad = false;
      _pedirPermiso();
      
      // Mostrar indicador visual persistente de que el monitor está activo
      let ind = document.getElementById('admin-monitor-indicator');
      if (!ind) {
        ind = document.createElement('div');
        ind.id = 'admin-monitor-indicator';
        ind.style.cssText = 'position:fixed;bottom:10px;right:10px;background:rgba(0,0,0,0.8);color:#68d391;padding:5px 10px;border-radius:20px;font-size:0.75rem;z-index:9999;border:1px solid #68d391;cursor:pointer;';
        document.body.appendChild(ind);
        ind.onclick = () => {
          _alertar({ id: 'test', nombre: 'Prueba Local', whatsapp: '0000', urgencia: 'alta', servicio: 'Test Alerta' });
        };
      }
      _updateIndicator();

      console.log(`[AdminNotif] Monitor listo. Ignorando ${_seenIds.size} previas.`);
      return;
    }

    snap.docChanges().forEach(change => {
      if (change.type === 'added') _addedCount++;
      if (change.type === 'modified') _modCount++;
      
      // Firebase a veces dispara 'modified' en lugar de 'added' en escenarios de caché/sync rápidos
      if (change.type === 'added' || change.type === 'modified') {
        const id = change.doc.id;
        const data = change.doc.data();
        
        // Si no lo habíamos visto antes y no está leída, es una solicitud nueva para nosotros
        if (!_seenIds.has(id)) {
          _seenIds.add(id);
          _updateIndicator();
          
          if (!data.leida) {
            console.log('[AdminNotif] ¡Nueva solicitud detectada por red!', data.nombre, 'Tipo:', change.type);
            _alertar({ id, ...data });
          }
        }
      }
    });
    _updateIndicator();
  }, err => {
    console.error('[AdminNotif] Error en onSnapshot:', err.code, err.message);
    _unsubscribe = null; // permitir reintentar
  });
}

export function stopGlobalAdminNotifications() {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
    _seenIds.clear();
    _unsubscribe = null;
    _initialLoad = true;
    console.log('[AdminNotif] Monitor detenido.');
  }
}

// ── Orquestador de alerta ─────────────────────────────────────

function _alertar(data) {
  _tocarCampanas();
  _notificacionNativa(data);
  _mostrarModal(data);
  _mostrarToast('🔔 ¡Nueva solicitud recibida!');
}

// ── Toast propio (sin importar auth.js para evitar ciclo) ─────

function _mostrarToast(msg) {
  // Intentar usar el showToast global si está disponible
  if (typeof window._showToast === 'function') {
    window._showToast(msg, 'success');
    return;
  }
  // Fallback propio
  let t = document.getElementById('_notif_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_notif_toast';
    t.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#2f855a;color:#fff;padding:0.75rem 1.5rem;border-radius:0.75rem;font-weight:600;z-index:9999;font-size:0.95rem;box-shadow:0 4px 24px rgba(0,0,0,0.4);transition:opacity 0.4s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.style.opacity = '0'; }, 4000);
}

// ── Permiso de notificaciones ─────────────────────────────────

async function _pedirPermiso() {
  if (window.Capacitor?.Plugins?.LocalNotifications) {
    const LN = window.Capacitor.Plugins.LocalNotifications;
    try {
      await LN.createChannel({
        id: NOTIF_CHANNEL_ID, name: 'Nuevas Solicitudes',
        description: 'Alertas urgentes de solicitudes',
        importance: 5, sound: 'default', vibration: true, lights: true, visibility: 1,
      });
      await LN.requestPermissions();
    } catch (e) { console.warn('[AdminNotif] Error canal Capacitor:', e); }
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => console.log('[AdminNotif] Permiso notificaciones:', p));
  }
}

// ── 5 Campanadas ─────────────────────────────────────────────

function _tocarCampanas() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([300, 150, 300, 150, 300, 150, 300, 150, 300]);
    }

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('[AdminNotif] AudioContext no disponible'); return; }

    // Crear siempre un contexto nuevo para evitar el estado "suspended"
    const ctx = new AC();

    const play = () => {
      const numChimes    = 5;
      const chimeDuration = 0.65;

      for (let i = 0; i < numChimes; i++) {
        const osc1 = ctx.createOscillator();
        const g1   = ctx.createGain();
        osc1.connect(g1); g1.connect(ctx.destination);
        osc1.type = 'triangle';

        const osc2 = ctx.createOscillator();
        const g2   = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.type = 'sine';

        const t = ctx.currentTime + (i * chimeDuration);

        osc1.frequency.setValueAtTime(987.77, t);   // B5
        osc2.frequency.setValueAtTime(1318.51, t);  // E6 (armónico)

        g1.gain.setValueAtTime(0.0001, t);
        g1.gain.linearRampToValueAtTime(1.0, t + 0.04);
        g1.gain.exponentialRampToValueAtTime(0.0001, t + chimeDuration - 0.05);

        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.linearRampToValueAtTime(0.4, t + 0.04);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + chimeDuration - 0.05);

        osc1.start(t); osc1.stop(t + chimeDuration);
        osc2.start(t); osc2.stop(t + chimeDuration);
      }

      // Cerrar contexto 5s después para liberar recursos
      setTimeout(() => { try { ctx.close(); } catch(_){} }, (numChimes + 1) * chimeDuration * 1000);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play);
    } else {
      play();
    }
  } catch (e) {
    console.warn('[AdminNotif] Error reproduciendo campanadas:', e);
  }
}

// ── Notificación nativa del OS ────────────────────────────────

async function _notificacionNativa(data) {
  const urgEmoji = data.urgencia === 'alta' ? '🔴' : data.urgencia === 'media' ? '🟡' : '🟢';
  const title = `${urgEmoji} ¡Nueva Solicitud!`;
  const body  = `${data.nombre || '—'} solicita: ${data.servicio || '—'}`;

  if (window.Capacitor?.Plugins?.LocalNotifications) {
    const LN = window.Capacitor.Plugins.LocalNotifications;
    try {
      await LN.schedule({ notifications: [{
        title, body,
        id:          Math.floor(Math.random() * 2e9),
        channelId:   NOTIF_CHANNEL_ID,
        sound:       'default',
        actionTypeId: '',
        extra:       { solicitud: true }
      }]});
    } catch (e) { console.warn('[AdminNotif] Error notif Capacitor:', e); }

  } else if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body,
          icon: 'logo_oficial.png',
          requireInteraction: true,
          tag: 'nueva-solicitud'
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch (e) { console.warn('[AdminNotif] Error Notification API:', e); }
    } else if (Notification.permission === 'default') {
      // Pedir permiso de nuevo si lo necesita
      Notification.requestPermission();
    }
  }
}

// ── Modal emergente en pantalla ───────────────────────────────

function _mostrarModal(data) {
  const urgEmoji = data.urgencia === 'alta' ? '🔴' : data.urgencia === 'media' ? '🟡' : '🟢';

  let modal = document.getElementById('modal-incoming-request');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'modal-incoming-request';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const esAdmin    = window.location.pathname.includes('admin.html');
  const btnOnclick = esAdmin
    ? `(typeof verDetalles==='function' && verDetalles('${data.id}')); document.getElementById('modal-incoming-request').classList.remove('open');`
    : `window.location.href='admin.html?abrir=${data.id}'`;

  modal.innerHTML = `
    <div class="modal-box" style="max-width:460px;text-align:center;animation:fadeInUp 0.3s;">
      <div style="font-size:3.5rem;margin-bottom:0.5rem;">🔔</div>
      <h2 style="font-size:1.4rem;margin-bottom:1rem;color:var(--accent, #63b3ed);">¡Nueva Solicitud Recibida!</h2>
      <div style="background:rgba(255,255,255,0.05);padding:1rem;border-radius:0.75rem;text-align:left;margin-bottom:1.5rem;line-height:1.8;border:1px solid rgba(255,255,255,0.1);">
        <p><strong>👤 Cliente:</strong> ${data.nombre || '—'}</p>
        <p><strong>📱 WhatsApp:</strong> <span style="color:#68d391">${data.whatsapp || '—'}</span></p>
        <p><strong>⚡ Urgencia:</strong> ${urgEmoji} ${(data.urgencia || '').toUpperCase()}</p>
        <p style="margin-top:0.5rem;font-weight:700;color:var(--accent,#63b3ed);">🛠 ${data.servicio || '—'}</p>
      </div>
      <div style="display:flex;gap:0.75rem;justify-content:center;">
        <button class="btn btn-primary" onclick="${btnOnclick}" style="font-size:1rem;padding:0.6rem 1.5rem;">📋 Ver Solicitud</button>
        <button class="btn btn-ghost" onclick="document.getElementById('modal-incoming-request').classList.remove('open');">Cerrar</button>
      </div>
    </div>
  `;
  modal.classList.add('open');
}

// ── Desbloqueo del AudioContext al primer clic del usuario ────
// (requerido por la política de Chrome/Firefox)
document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, { once: true });
});
