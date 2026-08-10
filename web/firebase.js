// ============================================================
// firebase.js — Firebase Config + Firestore Offline Persistence
// InformaticaVES | El Técnico Luis
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
  valoraciones: 'valoraciones',
};

// ── Exportaciones ────────────────────────────────────────────
export {
  db, auth,
  collection, doc,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, setDoc,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
  COLS
};

// ── Helpers de DB ────────────────────────────────────────────

/** Obtiene todos los servicios publicados */
export async function getServiciosPublicados() {
  const q = query(
    collection(db, COLS.servicios),
    where('estado', '==', 'publicado')
  );
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort((a, b) => {
    if (a.categoria < b.categoria) return -1;
    if (a.categoria > b.categoria) return 1;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });
  return results;
}

/** Obtiene todos los servicios (admin) */
export async function getTodosServicios() {
  const snap = await getDocs(collection(db, COLS.servicios));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Guarda una solicitud en Firestore */
export async function guardarSolicitud(datos) {
  return addDoc(collection(db, COLS.solicitudes), {
    ...datos,
    timestamp: serverTimestamp(),
    leida: false
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

// ── Datos iniciales (seed) ────────────────────────────────────
// Servicios predeterminados — se cargan si Firestore está vacío
export const SERVICIOS_DEFAULT = [
  { nombre: 'Formateo y Reinstalación Windows', categoria: 'soporte', emoji: '💻',
    descripcion: 'Formateo completo con instalación de Windows 10/11, drivers y programas básicos.',
    precio: 15, moneda: 'USD', estado: 'publicado', popular: true },

  { nombre: 'Limpieza y Mantenimiento PC', categoria: 'soporte', emoji: '🧹',
    descripcion: 'Limpieza de polvo, cambio de pasta térmica, optimización de inicio y rendimiento.',
    precio: 10, moneda: 'USD', estado: 'publicado', popular: false },

  { nombre: 'Instalación Ubuntu / Linux Mint', categoria: 'soporte', emoji: '🐧',
    descripcion: 'Instalación y configuración de distros Linux con soporte post-instalación.',
    precio: 12, moneda: 'USD', estado: 'publicado', popular: false },

  { nombre: 'Recuperación de Datos', categoria: 'soporte', emoji: '💾',
    descripcion: 'Recuperación de archivos perdidos de discos duros, USB y tarjetas SD.',
    precio: 20, moneda: 'USD', estado: 'publicado', popular: false },

  { nombre: 'Configuración Red WiFi', categoria: 'redes', emoji: '📡',
    descripcion: 'Configuración de routers, extensores, VPN y diagnóstico de conectividad.',
    precio: 12, moneda: 'USD', estado: 'publicado', popular: false },

  { nombre: 'Cableado Estructurado', categoria: 'redes', emoji: '🔌',
    descripcion: 'Instalación de red cableada con puntos de acceso, switch y patch panel.',
    precio: 25, moneda: 'USD', estado: 'publicado', popular: false },

  { nombre: 'Instalación CCTV / DVR / NVR', categoria: 'cctv', emoji: '📹',
    descripcion: 'Instalación y configuración de cámaras de seguridad con acceso remoto.',
    precio: 35, moneda: 'USD', estado: 'publicado', popular: true },

  { nombre: 'Instalación Biométrico', categoria: 'cctv', emoji: '🔏',
    descripcion: 'Configuración de lectores biométricos para control de acceso y asistencia.',
    precio: 20, moneda: 'USD', estado: 'publicado', popular: false },

  { nombre: 'Diseño de Página Web', categoria: 'web', emoji: '🌐',
    descripcion: 'Landing page o sitio web profesional, responsive y optimizado para SEO.',
    precio: 80, moneda: 'USD', estado: 'publicado', popular: true },

  { nombre: 'App Android Personalizada', categoria: 'web', emoji: '📱',
    descripcion: 'Desarrollo de aplicación Android nativa o WebView con Firebase integrado.',
    precio: 150, moneda: 'USD', estado: 'publicado', popular: false },

  { nombre: 'Reparación Android (Software)', categoria: 'movil', emoji: '🔧',
    descripcion: 'Desbloqueo, flasheo, root, recuperación de sistema Android en celulares/tablets.',
    precio: 18, moneda: 'USD', estado: 'publicado', popular: false },

  { nombre: 'Configuración Correo Empresarial', categoria: 'soporte', emoji: '📧',
    descripcion: 'Configuración de Gmail Workspace, Outlook o servidor de correo propio.',
    precio: 15, moneda: 'USD', estado: 'publicado', popular: false },
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
