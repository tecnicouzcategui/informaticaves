import { db, COLS, query, collection, where, onSnapshot } from './firebase.js';
import { playStatusChangeSound, triggerVibration } from './sound-effects.js';

let _knownStatus = new Map();
let _initialLoad = true;
let unsubscribeNotifs = null;

function _tocarAlarma(estado) {
  playStatusChangeSound(estado || 'en_progreso');
}

function _mostrarModalAlerta(datos) {
  let modal = document.getElementById('modal-alerta-cliente');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-alerta-cliente';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9998;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:16px;padding:2rem;max-width:380px;width:90%;text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;" id="alerta-cliente-icono">📢</div>
        <h2 style="color:var(--text,#fff);font-size:1.3rem;margin-bottom:1rem;" id="alerta-cliente-titulo">¡Actualización en tu solicitud!</h2>
        <div id="alerta-cliente-contenido" style="background:rgba(0,0,0,0.3);border-radius:8px;padding:1rem;text-align:left;margin-bottom:1.5rem;font-size:0.9rem;"></div>
        <div style="display:flex;gap:1rem;justify-content:center;">
          <button id="alerta-cliente-ver" style="background:#4a9eff;color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:8px;cursor:pointer;font-size:0.9rem;">Ver Mis Solicitudes</button>
          <button id="alerta-cliente-cerrar" style="background:transparent;color:#aaa;border:1px solid #555;padding:0.6rem 1.5rem;border-radius:8px;cursor:pointer;font-size:0.9rem;">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  
  let estadoText = '';
  let icono = '📢';
  if (datos.estadoCaso === 'tomado') { estadoText = 'Tomado (En proceso)'; icono = '🛠️'; }
  else if (datos.estadoCaso === 'finalizado') { estadoText = '¡Finalizado!'; icono = '✅'; }
  else if (datos.estadoCaso === 'cancelado') { estadoText = 'Cancelado'; icono = '❌'; }
  
  document.getElementById('alerta-cliente-icono').textContent = icono;
  document.getElementById('alerta-cliente-contenido').innerHTML =
    `<p>🔧 <strong>Servicio:</strong> ${datos.servicio || '—'}</p>
     <p>📌 <strong>Nuevo Estado:</strong> <span style="color:#68d391">${estadoText}</span></p>`;
  
  modal.style.display = 'flex';
  
  document.getElementById('alerta-cliente-ver').onclick = () => { 
    modal.style.display = 'none'; 
    window.location.href = 'mis-solicitudes.html';
  };
  
  document.getElementById('alerta-cliente-cerrar').onclick = () => { 
    modal.style.display = 'none'; 
  };
}

export function initGlobalClientNotifications(whatsapp) {
  if (unsubscribeNotifs) {
    unsubscribeNotifs(); // Si cambia el numero, reiniciamos
    unsubscribeNotifs = null;
  }
  if (!whatsapp) return;

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  const q = query(collection(db, COLS.solicitudes), where('whatsapp', '==', whatsapp));

  unsubscribeNotifs = onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      const id = change.doc.id;
      const data = change.doc.data();
      const nuevoEstado = data.estadoCaso || 'pendiente';
      
      if (change.type === 'added') {
        _knownStatus.set(id, nuevoEstado);
      } else if (change.type === 'modified') {
        const viejoEstado = _knownStatus.get(id);
        if (viejoEstado !== nuevoEstado && nuevoEstado !== 'pendiente') {
          _knownStatus.set(id, nuevoEstado);
          if (!_initialLoad) {
            _tocarAlarma(nuevoEstado);
            _mostrarModalAlerta({ id, ...data });
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('🔔 Actualización de Solicitud', {
                body: `Tu solicitud "${data.servicio}" ahora está: ${nuevoEstado}`,
                icon: './img/logo.png',
                badge: './img/logo.png',
                vibrate: [200, 100, 200, 100, 300]
              });
            }
          }
        }
      }
    });
    _initialLoad = false;
  });
}
