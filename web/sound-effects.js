/**
 * sound-effects.js — Sistema Unificado de Alarmas Sonoras y Vibración Háptica
 * Informáticos Venezuela Help Desk & App Móvil
 * 
 * Genera sonidos nítidos y profesionales con Web Audio API (cero dependencias externas,
 * 100% offline, latencia ultra-baja) y coordina patrones de vibración para Android y PWA.
 */

let _audioCtx = null;

/**
 * Obtiene o inicializa el contexto de audio garantizando su desbloqueo
 */
function getAudioContext() {
  try {
    if (!_audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        _audioCtx = new AudioContextClass();
      }
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  } catch (e) {
    console.warn('[SoundEffects] No se pudo inicializar AudioContext:', e);
    return null;
  }
}

// Desbloquear audio automáticamente al primer toque/clic en cualquier parte de la pantalla
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      ['click', 'touchstart', 'touchend', 'keydown'].forEach(ev => {
        window.removeEventListener(ev, unlockAudio);
      });
    }
  };
  ['click', 'touchstart', 'touchend', 'keydown'].forEach(ev => {
    window.addEventListener(ev, unlockAudio, { passive: true });
  });
}

/**
 * Dispara la vibración física del dispositivo móvil
 * @param {number|number[]} pattern - Milisegundos o patrón [vibra, pausa, vibra...]
 */
export function triggerVibration(pattern = [200]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Ignorado si el navegador bloquea vibración por políticas
  }
}

/**
 * ALARMA SONORA: Nueva Solicitud de Asistencia Entrante
 * Genera una potente alarma de despacho de dos tonos pulsantes alternos con vibración enérgica.
 */
export function playAlarmSound() {
  triggerVibration([400, 150, 400, 150, 400, 150, 600]);

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const startTime = ctx.currentTime;
    // Ráfagas alternas de alta frecuencia (880 Hz / 1175 Hz)
    const tones = [
      { f: 880,  t: 0.00, d: 0.14, gain: 0.5 },
      { f: 1175, t: 0.15, d: 0.14, gain: 0.55 },
      { f: 880,  t: 0.32, d: 0.14, gain: 0.5 },
      { f: 1175, t: 0.47, d: 0.14, gain: 0.55 },
      { f: 880,  t: 0.64, d: 0.14, gain: 0.5 },
      { f: 1175, t: 0.79, d: 0.22, gain: 0.6 }
    ];

    tones.forEach(({ f, t, d, gain }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle'; // Onda triangle: más rica armónicamente y clara en parlantes móviles
      osc.frequency.setValueAtTime(f, startTime + t);

      g.gain.setValueAtTime(0.001, startTime + t);
      g.gain.linearRampToValueAtTime(gain, startTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + t + d);

      osc.connect(g);
      g.connect(ctx.destination);

      osc.start(startTime + t);
      osc.stop(startTime + t + d + 0.05);
    });
  } catch (err) {
    console.warn('[SoundEffects] Error tocando alarma:', err);
  }
}

/**
 * SONIDO: Caso Tomado o Asignado a Técnico
 * Acorde mayor ascendente nítido y enérgico (Do-Mi-Sol-Do) con vibración de confirmación.
 */
export function playCaseTakenSound() {
  triggerVibration([150, 80, 250]);

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const startTime = ctx.currentTime;
    const notes = [
      { f: 523.25, t: 0.00, d: 0.18, gain: 0.4 }, // C5
      { f: 659.25, t: 0.12, d: 0.18, gain: 0.4 }, // E5
      { f: 783.99, t: 0.24, d: 0.18, gain: 0.45 },// G5
      { f: 1046.5, t: 0.36, d: 0.35, gain: 0.5 }  // C6
    ];

    notes.forEach(({ f, t, d, gain }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, startTime + t);

      g.gain.setValueAtTime(0.01, startTime + t);
      g.gain.linearRampToValueAtTime(gain, startTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + t + d);

      osc.connect(g);
      g.connect(ctx.destination);

      osc.start(startTime + t);
      osc.stop(startTime + t + d + 0.02);
    });
  } catch (err) {
    console.warn('[SoundEffects] Error en playCaseTakenSound:', err);
  }
}

/**
 * SONIDO: Cambio de Estatus de una Solicitud
 * Distingue acústicamente entre: en camino, en progreso, finalizado, cancelado.
 * @param {string} estado - 'en_camino' | 'en_progreso' | 'finalizado' | 'cancelado' | 'tomado' | etc.
 */
export function playStatusChangeSound(estado) {
  const normEstado = (estado || '').toLowerCase().trim();

  if (normEstado === 'tomado') {
    playCaseTakenSound();
    return;
  }

  const ctx = getAudioContext();

  if (normEstado === 'en_camino') {
    // Tono rápido y dinámico de partida/movimiento
    triggerVibration([120, 60, 150]);
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      [
        { f: 587.33, t: 0.00, d: 0.12, gain: 0.35 },
        { f: 880.00, t: 0.10, d: 0.22, gain: 0.45 }
      ].forEach(({ f, t, d, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t0 + t);
        g.gain.setValueAtTime(0.01, t0 + t);
        g.gain.linearRampToValueAtTime(gain, t0 + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + t + d);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t0 + t);
        osc.stop(t0 + t + d);
      });
    } catch (_) {}

  } else if (normEstado === 'en_progreso') {
    // Tono de trabajo activo
    triggerVibration([150, 100, 150]);
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      [
        { f: 659.25, t: 0.00, d: 0.14, gain: 0.35 },
        { f: 783.99, t: 0.12, d: 0.25, gain: 0.4 }
      ].forEach(({ f, t, d, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t0 + t);
        g.gain.setValueAtTime(0.01, t0 + t);
        g.gain.linearRampToValueAtTime(gain, t0 + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + t + d);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t0 + t);
        osc.stop(t0 + t + d);
      });
    } catch (_) {}

  } else if (normEstado === 'finalizado') {
    // Fanfarria de victoria y trabajo culminado
    triggerVibration([200, 100, 200, 100, 400]);
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      [
        { f: 523.25, t: 0.00, d: 0.16, gain: 0.4 }, // C5
        { f: 659.25, t: 0.12, d: 0.16, gain: 0.4 }, // E5
        { f: 783.99, t: 0.22, d: 0.18, gain: 0.45 },// G5
        { f: 1046.5, t: 0.34, d: 0.20, gain: 0.5 }, // C6
        { f: 1318.5, t: 0.46, d: 0.45, gain: 0.55 } // E6
      ].forEach(({ f, t, d, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t0 + t);
        g.gain.setValueAtTime(0.01, t0 + t);
        g.gain.linearRampToValueAtTime(gain, t0 + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + t + d);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t0 + t);
        osc.stop(t0 + t + d);
      });
    } catch (_) {}

  } else if (normEstado === 'cancelado') {
    // Tono descendente de aviso
    triggerVibration([300]);
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      [
        { f: 440.0, t: 0.00, d: 0.20, gain: 0.35 },
        { f: 261.6, t: 0.18, d: 0.35, gain: 0.35 }
      ].forEach(({ f, t, d, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t0 + t);
        g.gain.setValueAtTime(0.01, t0 + t);
        g.gain.linearRampToValueAtTime(gain, t0 + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + t + d);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t0 + t);
        osc.stop(t0 + t + d);
      });
    } catch (_) {}

  } else {
    // Sonido estándar de notificación
    playNotificationSound();
  }
}

/**
 * SONIDO: Confirmación de Nueva Solicitud Creada por el Usuario
 */
export function playNewRequestCreatedSound() {
  triggerVibration([150, 80, 200]);

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;
    [
      { f: 659.25, t: 0.00, d: 0.15, gain: 0.4 },
      { f: 880.00, t: 0.12, d: 0.18, gain: 0.45 },
      { f: 1046.5, t: 0.24, d: 0.30, gain: 0.5 }
    ].forEach(({ f, t, d, gain }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0 + t);
      g.gain.setValueAtTime(0.01, t0 + t);
      g.gain.linearRampToValueAtTime(gain, t0 + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + t + d);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0 + t);
      osc.stop(t0 + t + d);
    });
  } catch (_) {}
}

/**
 * SONIDO: Notificación General / Alerta Limpia
 */
export function playNotificationSound() {
  triggerVibration([150]);

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;
    [
      { f: 800,  t: 0.00, d: 0.12, gain: 0.35 },
      { f: 1100, t: 0.10, d: 0.20, gain: 0.4 }
    ].forEach(({ f, t, d, gain }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0 + t);
      g.gain.setValueAtTime(0.01, t0 + t);
      g.gain.linearRampToValueAtTime(gain, t0 + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + t + d);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0 + t);
      osc.stop(t0 + t + d);
    });
  } catch (_) {}
}

// Exportar funciones globalmente en window para llamadas rápidas desde scripts no modulares
if (typeof window !== 'undefined') {
  window.SoundEffects = {
    playAlarmSound,
    playCaseTakenSound,
    playStatusChangeSound,
    playNewRequestCreatedSound,
    playNotificationSound,
    triggerVibration
  };
}
