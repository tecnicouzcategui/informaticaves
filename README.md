# InformaticaVES — El Técnico Luis ⚡

> **Aplicación web y Android para soporte técnico especializado**  
> Luis Uzcátegui | 30 años de experiencia | Caracas, Venezuela

[![Build APK](https://github.com/TU_USUARIO/informaticaVES/actions/workflows/build_apk.yml/badge.svg)](https://github.com/TU_USUARIO/informaticaVES/actions/workflows/build_apk.yml)

---

## 📱 Descripción

**InformaticaVES** es una Progressive Web App (PWA) + App Android que permite a los clientes de El Técnico Luis:

- 📋 **Consultar el catálogo** de servicios informáticos con precios actualizados
- 🔧 **Solicitar servicios** con selección de urgencia y alertas automáticas a Telegram
- 🔐 **Iniciar sesión** con Google para hacer seguimiento de sus solicitudes
- 📴 **Funcionar offline** gracias a Firestore persistence + Service Worker

### Para el administrador (`tecnicouzcategui@gmail.com`):
- 🛠 **Panel Admin** con gestión de servicios (Borrador → Publicado)
- 📥 **Bandeja de solicitudes** en tiempo real
- ❓ **Gestión de FAQs**

---

## 🏗️ Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Frontend Web | HTML5 + CSS3 + JavaScript ES6+ |
| Backend / DB | Firebase Firestore |
| Autenticación | Firebase Auth (Google OAuth) |
| Alertas | Telegram Bot API |
| App Android | Android Nativo (Kotlin) + WebView |
| CI/CD | GitHub Actions |
| Hosting Web | Netlify |

---

## 📁 Estructura del Proyecto

```
informaticaVES/
├── web/                    ← PWA (HTML + CSS + JS)
│   ├── index.html          ← Página principal
│   ├── servicios.html      ← Catálogo de servicios
│   ├── solicitud.html      ← Formulario de solicitud
│   ├── admin.html          ← Panel administrador
│   ├── style.css           ← Estilos globales
│   ├── firebase.js         ← Firebase config + helpers
│   ├── auth.js             ← Google Auth + WhatsApp modal
│   ├── solicitud.js        ← Formulario + Telegram API
│   ├── admin.js            ← CRUD admin
│   ├── sw.js               ← Service Worker (offline)
│   └── manifest.json       ← PWA manifest
│
├── app/                    ← App Android (Kotlin)
│   └── src/main/
│       ├── java/…/MainActivity.kt
│       ├── assets/web/     ← Copia de web/ para APK
│       └── res/
│
└── .github/workflows/
    └── build_apk.yml       ← CI/CD para compilar APK
```

---

## 🚀 Configuración Inicial

### Firebase
1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Proyecto: `informaticaves`
3. Activar: **Authentication** (Google provider) + **Firestore Database**
4. En Firestore, activar modo de producción y crear reglas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Servicios: lectura pública, escritura solo admin
    match /servicios/{doc} {
      allow read: if true;
      allow write: if request.auth.token.email == 'tecnicouzcategui@gmail.com';
    }
    // Solicitudes: cualquiera puede crear, solo admin lee
    match /solicitudes/{doc} {
      allow create: if true;
      allow read, update: if request.auth.token.email == 'tecnicouzcategui@gmail.com';
    }
    // Clientes: solo el propio usuario
    match /clientes/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    // FAQ: lectura pública, escritura admin
    match /faq/{doc} {
      allow read: if true;
      allow write: if request.auth.token.email == 'tecnicouzcategui@gmail.com';
    }
  }
}
```

### Google Auth
En Firebase Console → Authentication → Sign-in method → Google → Habilitar.  
Agregar dominio autorizado: `eltecnicoluis.netlify.app`

---

## 🔨 Compilar APK

```bash
# En Windows:
.\gradlew assembleDebug

# El APK queda en:
app\build\outputs\apk\debug\app-debug.apk
```

O usar **GitHub Actions**: cada push a `main` compila el APK automáticamente y lo deja disponible como artefacto descargable.

---

## 📤 Subir a GitHub (primera vez)

```bash
git init
git add .
git commit -m "feat: InformaticaVES v2.0 — PWA + Android WebView"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/informaticaVES.git
git push -u origin main
```

---

## 📞 Contacto

- **WhatsApp:** [+58 424-296-4339](https://wa.me/584242964339)
- **Telegram:** [@eltecnicoluis](https://t.me/eltecnicoluis)
- **Web:** [eltecnicoluis.netlify.app](https://eltecnicoluis.netlify.app)

---

*Desarrollado con ❤️ para El Técnico Luis — InformaticaVES 2025*
