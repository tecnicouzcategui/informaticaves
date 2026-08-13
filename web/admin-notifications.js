import { db, COLS, query, collection, orderBy, limit, onSnapshot } from './firebase.js';

let _notifSeenIds = new Set();
let _initialLoad = true;
let _audioCtx = null;

function _tocarAlarma() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();

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
          <button id="alerta-ver" style="background:#4a9eff;color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:8px;cursor:pointer;font-size:0.9rem;">📋 Ver</button>
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
  
  document.getElementById('alerta-ver').onclick = () => { 
    modal.style.display = 'none'; 
    if (window.verDetalles) {
      window.verDetalles(datos.id);
    } else {
      window.location.href = 'admin.html';
    }
  };
  
  document.getElementById('alerta-cerrar').onclick = () => { 
    modal.style.display = 'none'; 
  };
}

function _alertarNuevaSolicitud(datos) {
  _tocarAlarma();
  _mostrarModalAlerta(datos);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('⚡ Nueva Solicitud', { body: `${datos.nombre} — ${datos.servicio}`, icon: './img/logo.png' });
  }
}

let unsubscribeNotifs = null;

export function initGlobalAdminNotifications() {
  if (unsubscribeNotifs) return; // Ya está escuchando

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Escuchar solo las ultimas 5 solicitudes (suficiente para notificar las nuevas globales)
  const q = query(collection(db, COLS.solicitudes), orderBy('timestamp', 'desc'), limit(5));

  unsubscribeNotifs = onSnapshot(q, snap => {
    const ahora = Date.now();
    snap.docChanges().forEach(change => {
      const id = change.doc.id;
      const data = change.doc.data();
      
      // change.type === 'modified' con !data.leida dispara de nuevo si alguien la marca como no leída
      // !_notifSeenIds garantiza que solo suene una vez por cliente
      if ((change.type === 'added' || change.type === 'modified') && !data.leida && !_notifSeenIds.has(id)) {
        _notifSeenIds.add(id);
        
        if (!_initialLoad) {
          _alertarNuevaSolicitud({ id, ...data });
        } else if (data.timestamp) {
          const docMs = data.timestamp.toDate ? data.timestamp.toDate().getTime() : 0;
          // Solo alertar notificaciones muy recientes en carga inicial
          if (ahora - docMs < 60000) _alertarNuevaSolicitud({ id, ...data });
        }
      }
    });
    _initialLoad = false;
  });
}
