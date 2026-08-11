// ============================================================
// admin-notifications.js — Monitor global de solicitudes
// Se activa en CUALQUIER página cuando el admin está logueado
// InformaticaVES | El Técnico Luis
// ============================================================

import { db, collection, query, orderBy, onSnapshot } from './firebase.js';
import { showToast } from './auth.js';

const NOTIF_CHANNEL_ID = 'ives_solicitudes_high';
const COLS_SOLICITUDES = 'ives_solicitudes';

let _unsubscribe = null;
let _initialLoad = true;
// AudioContext reutilizable para evitar problemas de política del navegador
let _audioCtx = null;

// ── API pública ───────────────────────────────────────────────

export function initGlobalAdminNotifications() {
  if (_unsubscribe) return; // ya está escuchando

  _initialLoad = true; // reiniciar en cada sesión de admin

  const q = query(collection(db, COLS_SOLICITUDES), orderBy('timestamp', 'desc'));

  _unsubscribe = onSnapshot(q, snap => {
    if (!_initialLoad) {
      snap.docChanges().forEach(change => {
        if (change.type === 'added' && !change.doc.data().leida) {
          const data = { id: change.doc.id, ...change.doc.data() };
          _alertarNuevaSolicitud(data);
        }
      });
    } else {
      _initialLoad = false;
      _pedirPermiso();
    }
  }, err => {
    console.warn('[AdminNotif] Error en onSnapshot:', err);
  });

  console.log('[AdminNotif] Escuchando solicitudes en todas las páginas.');
}

export function stopGlobalAdminNotifications() {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
    _initialLoad = true;
    console.log('[AdminNotif] Detenido.');
  }
}

// ── Funciones internas ────────────────────────────────────────

function _alertarNuevaSolicitud(data) {
  _tocarCampanas();
  _notificacionNativa(data);
  _mostrarModal(data);
  showToast('🔔 ¡Nueva solicitud recibida!', 'success');
}

// Solicitar permiso de notificaciones nativas
async function _pedirPermiso() {
  if (window.Capacitor?.Plugins?.LocalNotifications) {
    const LN = window.Capacitor.Plugins.LocalNotifications;
    try {
      await LN.createChannel({
        id: NOTIF_CHANNEL_ID, name: 'Nuevas Solicitudes',
        description: 'Alertas urgentes de solicitudes', importance: 5,
        sound: 'default', vibration: true, lights: true, visibility: 1,
      });
      await LN.requestPermissions();
    } catch (e) { console.warn('[AdminNotif] Error canal Capacitor:', e); }
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Tocar las 5 campanadas
function _tocarCampanas() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([300, 150, 300, 150, 300, 150, 300, 150, 300]);
    }

    // Crear o reutilizar AudioContext
    if (!_audioCtx || _audioCtx.state === 'closed') {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _audioCtx = new AC();
    }

    const ctx = _audioCtx;

    const play = () => {
      const numChimes = 5;
      const chimeDuration = 0.6;

      for (let i = 0; i < numChimes; i++) {
        // Campana principal (nota B5)
        const osc1 = ctx.createOscillator();
        const g1   = ctx.createGain();
        osc1.connect(g1); g1.connect(ctx.destination);
        osc1.type = 'triangle';

        // Armónico (octava, para mayor riqueza)
        const osc2 = ctx.createOscillator();
        const g2   = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.type = 'sine';

        const t = ctx.currentTime + (i * chimeDuration);
        osc1.frequency.setValueAtTime(987.77, t);
        osc2.frequency.setValueAtTime(1975.54, t);

        // Envolvente: ataque instantáneo, decaimiento largo
        g1.gain.setValueAtTime(0.0001, t);
        g1.gain.linearRampToValueAtTime(0.8, t + 0.03);
        g1.gain.exponentialRampToValueAtTime(0.0001, t + chimeDuration - 0.05);

        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.linearRampToValueAtTime(0.3, t + 0.03);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + chimeDuration - 0.05);

        osc1.start(t); osc1.stop(t + chimeDuration);
        osc2.start(t); osc2.stop(t + chimeDuration);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(e => console.warn('[AdminNotif] No se pudo reanudar AudioContext:', e));
    } else {
      play();
    }
  } catch (e) {
    console.warn('[AdminNotif] Error reproduciendo sonido:', e);
  }
}

// Notificación nativa del sistema operativo
async function _notificacionNativa(data) {
  const urgEmoji = data.urgencia === 'alta' ? '🔴' : data.urgencia === 'media' ? '🟡' : '🟢';
  const title = `${urgEmoji} ¡Nueva Solicitud!`;
  const body  = `${data.nombre} solicita: ${data.servicio}`;

  if (window.Capacitor?.Plugins?.LocalNotifications) {
    const LN = window.Capacitor.Plugins.LocalNotifications;
    try {
      await LN.schedule({ notifications: [{
        title, body, id: Math.floor(Math.random() * 2e9),
        channelId: NOTIF_CHANNEL_ID, sound: 'default', actionTypeId: '',
        extra: { solicitud: true }
      }]});
    } catch (e) { console.warn('[AdminNotif] Error notif nativa:', e); }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon: 'logo_oficial.png', requireInteraction: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }
}

// Pop-up / modal dentro de la página
function _mostrarModal(data) {
  const urgEmoji = data.urgencia === 'alta' ? '🔴' : data.urgencia === 'media' ? '🟡' : '🟢';

  let modal = document.getElementById('modal-incoming-request');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-incoming-request';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const esAdmin = window.location.pathname.includes('admin.html');
  const btnAccion = esAdmin
    ? `onclick="if(typeof verDetalles==='function') verDetalles('${data.id}'); document.getElementById('modal-incoming-request').classList.remove('open');"`
    : `onclick="window.location.href='admin.html?abrir=${data.id}'"`;

  modal.innerHTML = `
    <div class="modal-box" style="max-width:460px;text-align:center;">
      <div style="font-size:3rem;margin-bottom:0.5rem;animation:pulse 1s infinite;">🔔</div>
      <h2 style="font-size:1.4rem;margin-bottom:1rem;color:var(--accent);">¡Nueva Solicitud Recibida!</h2>
      <div style="background:var(--bg-card);padding:1rem;border-radius:var(--radius-sm);text-align:left;margin-bottom:1.5rem;line-height:1.7;">
        <p><strong>👤 Cliente:</strong> ${data.nombre || '—'}</p>
        <p><strong>📱 WhatsApp:</strong> <span style="color:var(--green)">${data.whatsapp || '—'}</span></p>
        <p><strong>⚡ Urgencia:</strong> ${urgEmoji} ${(data.urgencia || '').toUpperCase()}</p>
        <p style="margin-top:0.5rem;font-weight:600;color:var(--accent);">🛠 ${data.servicio || '—'}</p>
      </div>
      <div style="display:flex;gap:0.75rem;justify-content:center;">
        <button class="btn btn-primary" ${btnAccion}>📋 Ver Solicitud</button>
        <button class="btn btn-ghost" onclick="document.getElementById('modal-incoming-request').classList.remove('open');">Cerrar</button>
      </div>
    </div>
  `;
  modal.classList.add('open');
}

// Activar permiso al primer clic del usuario (política del navegador)
document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // Desbloquear AudioContext al primer clic
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
  }, { once: true });
});
