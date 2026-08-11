import { db, collection, query, orderBy, onSnapshot } from './firebase.js';
import { showToast } from './auth.js';

let globalUnsubscribe = null;
let solicitudesInitialLoad = true;
const NOTIF_CHANNEL_ID = 'ives_solicitudes_high';

export function initGlobalAdminNotifications() {
  if (globalUnsubscribe) return; // Ya está corriendo

  const q = query(collection(db, 'ives_solicitudes'), orderBy('timestamp', 'desc'));
  
  globalUnsubscribe = onSnapshot(q, snap => {
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
    
    if (solicitudesInitialLoad) {
      solicitudesInitialLoad = false;
      solicitarPermisoNotificaciones();
    }
  });
}

export function stopGlobalAdminNotifications() {
  if (globalUnsubscribe) {
    globalUnsubscribe();
    globalUnsubscribe = null;
  }
}

async function solicitarPermisoNotificaciones() {
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
    } catch (e) { console.warn('[Notif] Error configurando canal:', e); }
  } else if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}

document.body.addEventListener('click', () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, { once: true });

async function dispararNotificacionNativa(data) {
  const urgEmoji = data.urgencia === 'alta' ? '🔴' : data.urgencia === 'media' ? '🟡' : '🟢';
  const title = `${urgEmoji} ¡Nueva Solicitud!`;
  const body = `${data.nombre} solicita: ${data.servicio}`;

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
    } catch (e) { console.warn('[Notif] Error disparando notificación nativa:', e); }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: body, icon: 'logo_oficial.png' });
  }
}

function playNotificationSound() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200, 100, 200, 100, 200]);
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (ctx.state === 'suspended') {
      ctx.resume().catch(e => console.warn('[Sound] No se pudo reanudar AudioContext:', e));
    }
    
    const numChimes = 5;
    const chimeDuration = 0.5;
    
    for (let i = 0; i < numChimes; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const startTime = ctx.currentTime + (i * chimeDuration);
      osc.frequency.setValueAtTime(987.77, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.6, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.45);
      gain.gain.setValueAtTime(0, startTime + chimeDuration);
      osc.start(startTime);
      osc.stop(startTime + chimeDuration);
    }
  } catch (e) { console.warn('[Sound] AudioContext bloqueado.', e); }
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
  
  const isDocAdmin = window.location.pathname.includes('admin.html');
  const actionClick = isDocAdmin ? `verDetalles('${data.id}'); document.getElementById('modal-incoming-request').classList.remove('open');` : `window.location.href='admin.html?abrir=${data.id}'`;

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
        <button class="btn btn-primary" onclick="${actionClick}">Ir al Panel</button>
        <button class="btn btn-ghost" onclick="document.getElementById('modal-incoming-request').classList.remove('open');">Cerrar</button>
      </div>
    </div>
  `;
  modal.classList.add('open');
}
