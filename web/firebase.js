// ============================================================
// firebase.js — Firebase Config + Firestore Offline Persistence
// Informáticos Venezuela | El Técnico Luis
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getFirestore,
  enableIndexedDbPersistence,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

// ── Configuración Firebase ──────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDW9oJLi36JNdIPwUUKaobew1k_-veG89U",
  authDomain:        "informaticaves.firebaseapp.com",
  projectId:         "informaticaves",
  storageBucket:     "informaticaves.firebasestorage.app",
  messagingSenderId: "56325689764",
  appId:             "1:56325689764:android:3e68401ed81cf10bb27131"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Activar persistencia offline (Firestore) ────────────────
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firestore] Persistencia fallida: múltiples pestañas abiertas.');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firestore] Persistencia no soportada en este navegador.');
  }
});

// ── Colecciones ─────────────────────────────────────────────
const COLS = {
  servicios:    'servicios',
  solicitudes:  'solicitudes',
  faq:          'faq',
  clientes:     'clientes',
  tecnicos:     'tecnicos',
  valoraciones: 'valoraciones',
};

// ── Exportaciones ────────────────────────────────────────────
export {
  db, auth,
  collection, doc,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, setDoc,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  COLS
};

// ── Helpers de DB ────────────────────────────────────────────

/** Obtiene todos los servicios publicados (del catálogo general y de técnicos activos) */
export async function getServiciosPublicados() {
  try {
    const q = query(
      collection(db, COLS.servicios),
      where('estado', '==', 'publicado')
    );
    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // También incorporar servicios agregados por técnicos activos si existen
    try {
      const qTec = query(collection(db, COLS.tecnicos), where('estado', '==', 'activo'));
      const snapTec = await getDocs(qTec);
      snapTec.docs.forEach(d => {
        const tec = d.data();
        if (tec.servicios && Array.isArray(tec.servicios)) {
          tec.servicios.forEach((ts, idx) => {
            if (ts && ts.estado !== 'borrador' && ts.estado !== 'inactivo') {
              results.push({
                id: ts.id || `tec_${d.id}_${idx}`,
                nombre: ts.nombre || ts.titulo || 'Servicio Técnico Especializado',
                categoria: ts.categoria || 'soporte',
                emoji: ts.emoji || '⚡',
                descripcion: ts.descripcion || `Especialidad ofrecida por ${tec.nombre || 'Técnico IT'} (${tec.zona || 'Venezuela'})`,
                precio: Number(ts.precio) || 15,
                moneda: ts.moneda || 'USD',
                estado: 'publicado',
                popular: !!ts.popular,
                tecnicoId: d.id,
                tecnicoNombre: tec.nombre
              });
            }
          });
        }
      });
    } catch (_) {}

    if (!results.length) {
      results = SERVICIOS_DEFAULT.filter(s => s.estado === 'publicado');
    }

    results.sort((a, b) => {
      if (a.categoria < b.categoria) return -1;
      if (a.categoria > b.categoria) return 1;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
    return results;
  } catch (err) {
    console.warn('[getServiciosPublicados] Error:', err);
    return SERVICIOS_DEFAULT.filter(s => s.estado === 'publicado');
  }
}

/** Obtiene todos los servicios (admin) */
export async function getTodosServicios() {
  const snap = await getDocs(collection(db, COLS.servicios));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Guarda una solicitud / Ticket Help Desk en Firestore con correlativo automático */
export async function guardarSolicitud(datos) {
  let correlativo = 1001;
  try {
    const snap = await getDocs(collection(db, COLS.solicitudes));
    correlativo = 1001 + snap.size;
  } catch (_) {}

  const correlativoStr = `TICK-${correlativo}`;

  return addDoc(collection(db, COLS.solicitudes), {
    ...datos,
    correlativo: correlativoStr,
    correlativoNum: correlativo,
    timestamp: serverTimestamp(),
    leida: false,
    estadoCaso: datos.estadoCaso || 'pendiente'
  });
}

/** Guarda o actualiza el perfil de un cliente */
export async function guardarCliente(uid, datos) {
  return setDoc(doc(db, COLS.clientes, uid), {
    ...datos,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/** Obtiene el perfil de un cliente */
export async function getCliente(uid) {
  const snap = await getDoc(doc(db, COLS.clientes, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Busca si un número de WhatsApp ya tiene cuenta registrada */
export async function getClienteByWA(wa) {
  const q = query(collection(db, COLS.clientes), where('whatsapp', '==', wa));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/** Busca si una cédula ya tiene cuenta registrada */
export async function getClienteByCedula(cedula) {
  if (!cedula) return null;
  const clean = cedula.trim().toUpperCase();
  const q = query(collection(db, COLS.clientes), where('cedula', '==', clean));
  const snap = await getDocs(q);
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  
  // Buscar también por versión normalizada
  const numOnly = clean.replace(/[^0-9]/g, '');
  if (numOnly && numOnly !== clean) {
    const q2 = query(collection(db, COLS.clientes), where('cedula', '==', numOnly));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return { id: snap2.docs[0].id, ...snap2.docs[0].data() };
  }
  return null;
}

/** Obtiene todos los clientes registrados (para el administrador) */
export async function getTodosClientes() {
  const snap = await getDocs(collection(db, COLS.clientes));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Elimina un cliente de Firestore (Admin) */
export async function eliminarCliente(clienteId) {
  return deleteDoc(doc(db, COLS.clientes, clienteId));
}

/** Elimina un técnico de Firestore (Admin) */
export async function eliminarTecnico(tecnicoId) {
  return deleteDoc(doc(db, COLS.tecnicos, tecnicoId));
}

/** Convierte texto a hash SHA-256 (nativo del navegador, sin dependencias) */
export async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Busca cliente por WA + hash de contraseña (login sin Firebase Auth) */
export async function loginClienteByHash(wa, hash) {
  const q = query(collection(db, COLS.clientes), where('whatsapp', '==', wa), where('passwordHash', '==', hash));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/** Admin: restablece la contraseña guardando el nuevo hash en Firestore */
export async function setClientePasswordHash(wa, hash) {
  const q = query(collection(db, COLS.clientes), where('whatsapp', '==', wa));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  await updateDoc(doc(db, COLS.clientes, snap.docs[0].id), {
    passwordHash: hash,
    updatedAt: serverTimestamp()
  });
  return true;
}

/** Obtiene FAQs publicadas */
export async function getFAQsPublicadas() {
  const q = query(
    collection(db, COLS.faq),
    where('estado', '==', 'publicado')
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  return results;
}

// Servicios predeterminados — se cargan si Firestore está vacío
export const SERVICIOS_DEFAULT = [
  { id: 'formateo-windows', nombre: 'Formateo y Reinstalación Windows', categoria: 'soporte', emoji: '💻',
    descripcion: 'Formateo completo con instalación de Windows 10/11, drivers y programas básicos.',
    precio: 15, moneda: 'USD', estado: 'publicado', popular: true },

  { id: 'limpieza-pc', nombre: 'Limpieza y Mantenimiento PC', categoria: 'soporte', emoji: '🧹',
    descripcion: 'Limpieza de polvo, cambio de pasta térmica, optimización de inicio y rendimiento.',
    precio: 10, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'linux-mint', nombre: 'Instalación Ubuntu / Linux Mint', categoria: 'soporte', emoji: '🐧',
    descripcion: 'Instalación y configuración de distros Linux con soporte post-instalación.',
    precio: 12, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'recuperacion-datos', nombre: 'Recuperación de Datos', categoria: 'soporte', emoji: '💾',
    descripcion: 'Recuperación de archivos perdidos de discos duros, USB y tarjetas SD.',
    precio: 20, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'soporte-apple', nombre: 'Mantenimiento Apple & macOS', categoria: 'soporte', emoji: '🍏',
    descripcion: 'Diagnóstico, optimización y reinstalación de macOS en MacBook y iMac.',
    precio: 25, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'servidor-windows-ad', nombre: 'Windows Server & Active Directory', categoria: 'soporte', emoji: '🖥️',
    descripcion: 'Configuración de controladores de dominio, políticas GPO y carpetas compartidas.',
    precio: 45, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'red-wifi', nombre: 'Configuración Red WiFi', categoria: 'redes', emoji: '📡',
    descripcion: 'Configuración de routers, repetidores, VLAN y diagnóstico de conectividad.',
    precio: 12, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'cableado-estructurado', nombre: 'Cableado Estructurado', categoria: 'redes', emoji: '🔌',
    descripcion: 'Instalación de red cableada con puntos de red, switch y patch panel.',
    precio: 25, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'fibra-optica', nombre: 'Redes y Fibra Óptica', categoria: 'redes', emoji: '🌐',
    descripcion: 'Fusiones, conectorización y enlaces punto a punto para empresas y hogares.',
    precio: 35, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'cctv-camaras', nombre: 'Instalación CCTV / DVR / NVR', categoria: 'cctv', emoji: '📹',
    descripcion: 'Instalación y configuración de cámaras de seguridad con acceso remoto en vivo.',
    precio: 35, moneda: 'USD', estado: 'publicado', popular: true },

  { id: 'biometrico-acceso', nombre: 'Instalación Biométrico & Acceso', categoria: 'cctv', emoji: '🔏',
    descripcion: 'Configuración de lectores biométricos para control de acceso y asistencia.',
    precio: 20, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'diseno-web', nombre: 'Diseño de Página Web Profesional', categoria: 'web', emoji: '🌐',
    descripcion: 'Landing page o sitio web profesional, responsive y optimizado para Google SEO.',
    precio: 80, moneda: 'USD', estado: 'publicado', popular: true },

  { id: 'app-android', nombre: 'App Android Personalizada', categoria: 'web', emoji: '📱',
    descripcion: 'Desarrollo de aplicación Android nativa o PWA con Firebase y notificaciones push.',
    precio: 150, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'reparacion-android', nombre: 'Reparación Android (Software)', categoria: 'movil', emoji: '🔧',
    descripcion: 'Desbloqueo, flasheo, root y recuperación de sistema en celulares/tablets.',
    precio: 18, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'correo-empresarial', nombre: 'Configuración Correo Empresarial', categoria: 'soporte', emoji: '📧',
    descripcion: 'Configuración de Google Workspace, Microsoft 365 o servidores corporativos.',
    precio: 15, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'impresoras-fiscales', nombre: 'Soporte Impresoras & Fiscales', categoria: 'soporte', emoji: '🖨️',
    descripcion: 'Instalación de controladores, mantenimiento de impresoras térmicas y fiscales.',
    precio: 15, moneda: 'USD', estado: 'publicado', popular: false },

  { id: 'energia-ups', nombre: 'Energía, UPS & Inversores', categoria: 'soporte', emoji: '⚡',
    descripcion: 'Diagnóstico de baterías, respaldo eléctrico y protección de servidores.',
    precio: 20, moneda: 'USD', estado: 'publicado', popular: false }
];

/** Inicializa Firestore con datos predeterminados si está vacío */
export async function seedFirestoreIfEmpty() {
  const snap = await getDocs(collection(db, COLS.servicios));
  if (snap.empty) {
    console.log('[Seed] Inicializando servicios en Firestore...');
    for (const servicio of SERVICIOS_DEFAULT) {
      await addDoc(collection(db, COLS.servicios), {
        ...servicio,
        creadoEn: serverTimestamp()
      });
    }
    console.log('[Seed] Servicios inicializados.');
  }
}

const FAQS_DEFAULT = [
  { pregunta: '¿Cuánto tiempo tarda el servicio?',   respuesta: 'Depende del tipo de servicio. Un formateo puede tomar 2-3 horas, mientras que instalación de redes o CCTV puede tomar medio día.', orden: 1, estado: 'publicado' },
  { pregunta: '¿Hacen servicio a domicilio?',          respuesta: 'Sí, se ofrece servicio a domicilio en el área de Caracas y alrededores. Consultar disponibilidad.',                        orden: 2, estado: 'publicado' },
  { pregunta: '¿Qué formas de pago aceptan?',          respuesta: 'Efectivo en USD, transferencia bancaria, Pago Móvil y Zelle.',                                                            orden: 3, estado: 'publicado' },
  { pregunta: '¿Tienen garantía los servicios?',       respuesta: 'Sí, todos los servicios tienen garantía de 30 días en mano de obra.',                                                     orden: 4, estado: 'publicado' },
];

/** Migra las FAQs por defecto a Firestore si la colección está vacía */
export async function seedFAQsIfEmpty() {
  const snap = await getDocs(collection(db, COLS.faq));
  if (snap.empty) {
    console.log('[Seed] Inicializando FAQs en Firestore...');
    for (const faq of FAQS_DEFAULT) {
      await addDoc(collection(db, COLS.faq), {
        ...faq,
        creadoEn: serverTimestamp()
      });
    }
    console.log('[Seed] FAQs inicializadas.');
  }
}

/** Actualiza el estado de un caso (Help Desk) */
export async function actualizarEstadoCaso(solicitudId, nuevoEstado) {
  return updateDoc(doc(db, COLS.solicitudes, solicitudId), {
    estadoCaso: nuevoEstado,
    estadoCasoUpdatedAt: serverTimestamp()
  });
}

/** Guarda la valoración de un cliente */
export async function guardarValoracion(datos) {
  return addDoc(collection(db, COLS.valoraciones), {
    ...datos,
    timestamp: serverTimestamp()
  });
}

/** Obtiene todas las valoraciones (admin) */
export async function getValoraciones() {
  const snap = await getDocs(collection(db, COLS.valoraciones));
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort((a, b) => {
    const ta = a.timestamp?.seconds || 0;
    const tb = b.timestamp?.seconds || 0;
    return tb - ta;
  });
  return results;
}

/** Obtiene solicitudes de un cliente por número de WhatsApp */
export async function getSolicitudesByWhatsApp(whatsapp) {
  const q = query(
    collection(db, COLS.solicitudes),
    where('whatsapp', '==', whatsapp)
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort((a, b) => {
    const ta = a.timestamp?.seconds || 0;
    const tb = b.timestamp?.seconds || 0;
    return tb - ta;
  });
  return results;
}

/** Verifica si ya existe una valoración para una solicitud */
export async function getValoracionBySolicitud(solicitudId) {
  const q = query(
    collection(db, COLS.valoraciones),
    where('solicitudId', '==', solicitudId)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── Helpers para Gestión de Técnicos ─────────────────────────

/** Guarda o actualiza el perfil de un técnico */
export async function guardarTecnico(uid, datos) {
  return setDoc(doc(db, COLS.tecnicos, uid), {
    ...datos,
    rol: 'tecnico',
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/** Obtiene el perfil de un técnico por su UID */
export async function getTecnico(uid) {
  const snap = await getDoc(doc(db, COLS.tecnicos, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Busca si un número de WhatsApp ya tiene cuenta de técnico */
export async function getTecnicoByWA(wa) {
  const q = query(collection(db, COLS.tecnicos), where('whatsapp', '==', wa));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/** Busca si una cédula ya tiene cuenta de técnico */
export async function getTecnicoByCedula(cedula) {
  if (!cedula) return null;
  const clean = cedula.trim().toUpperCase();
  const q = query(collection(db, COLS.tecnicos), where('cedula', '==', clean));
  const snap = await getDocs(q);
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  
  const numOnly = clean.replace(/[^0-9]/g, '');
  if (numOnly && numOnly !== clean) {
    const q2 = query(collection(db, COLS.tecnicos), where('cedulaNum', '==', numOnly));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return { id: snap2.docs[0].id, ...snap2.docs[0].data() };
  }
  return null;
}

/** Obtiene todos los técnicos registrados (para el administrador) */
export async function getTodosTecnicos() {
  const snap = await getDocs(collection(db, COLS.tecnicos));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Actualiza el estado de aprobación de un técnico ('activo', 'pendiente', 'suspendido') */
export async function actualizarEstadoTecnico(tecnicoId, nuevoEstado) {
  return updateDoc(doc(db, COLS.tecnicos, tecnicoId), {
    estado: nuevoEstado,
    estadoUpdatedAt: serverTimestamp()
  });
}

/** Actualiza la disponibilidad de un técnico (true/false) */
export async function actualizarDisponibilidadTecnico(tecnicoId, disponible) {
  return updateDoc(doc(db, COLS.tecnicos, tecnicoId), {
    disponible: disponible,
    disponibilidadUpdatedAt: serverTimestamp()
  });
}

/** Asigna un técnico a una solicitud de servicio (Admin) */
export async function asignarTecnicoASolicitud(solicitudId, tecnicoData) {
  return updateDoc(doc(db, COLS.solicitudes, solicitudId), {
    tecnicoAsignadoId: tecnicoData ? tecnicoData.id : null,
    tecnicoNombre:     tecnicoData ? (tecnicoData.nombre || 'Técnico Asignado') : null,
    tecnicoWhatsApp:   tecnicoData ? (tecnicoData.whatsapp || '') : null,
    tecnicoEspecialidad: tecnicoData ? (tecnicoData.especialidades?.join(', ') || '') : null,
    asignadoEn:        tecnicoData ? serverTimestamp() : null,
    estadoCaso:        tecnicoData ? 'tomado' : 'pendiente'
  });
}

/** Obtiene todas las solicitudes asignadas a un técnico específico */
export async function getSolicitudesPorTecnico(tecnicoId) {
  const q = query(
    collection(db, COLS.solicitudes),
    where('tecnicoAsignadoId', '==', tecnicoId)
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort((a, b) => {
    const ta = a.timestamp?.seconds || 0;
    const tb = b.timestamp?.seconds || 0;
    return tb - ta;
  });
  return results;
}

/** Actualiza el estado de avance de un trabajo por parte del técnico */
export async function actualizarEstadoPorTecnico(solicitudId, nuevoEstado, notaTecnica = '') {
  const updatePayload = {
    estadoCaso: nuevoEstado,
    estadoCasoUpdatedAt: serverTimestamp()
  };
  if (notaTecnica) {
    updatePayload.notaTecnica = notaTecnica;
  }
  return updateDoc(doc(db, COLS.solicitudes, solicitudId), updatePayload);
}

