/**
 * Configuración de Firebase (app web) del proyecto "simondice-82f26".
 * Son valores públicos (identifican el proyecto, no dan acceso): la seguridad la ponen las reglas de Firestore.
 *
 * No se usa Analytics (`getAnalytics` no funciona en React Native), por eso no hay measurementId.
 * Si estos valores dicen "REEMPLAZAR", la app funciona sin nube (sin ranking ni respaldo de perfil).
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBmWxWVY-z7pkHntpS_5sUW4jT8ziYrHHA',
  authDomain: 'simondice-82f26.firebaseapp.com',
  projectId: 'simondice-82f26',
  storageBucket: 'simondice-82f26.firebasestorage.app',
  messagingSenderId: '867368344864',
  appId: '1:867368344864:web:4eae66ef5c63c6198dcb45',
};

export const FIREBASE_CONFIGURED = !FIREBASE_CONFIG.apiKey.includes('REEMPLAZAR');
