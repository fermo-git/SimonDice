/**
 * Base de datos en la nube (Firebase JS SDK: Auth anónima + Firestore).
 *
 * Colecciones:
 *  - users/{entryId}        perfil del jugador: apodo, récord, dificultad, si desbloqueó Ultra, packs comprados y sonido elegido
 *  - leaderboard/{entryId}  mejor puntaje de cada jugador (alimenta el ranking global)
 *  entryId = `${uid}_${playerId}`: un teléfono puede tener varios jugadores (uno por apodo) y cada uno se guarda aparte.
 *  - purchases/{id}     compras de prueba reportadas por la app
 *
 * Regla de oro: la nube NUNCA debe romper el juego. Todas las funciones atrapan sus errores
 * y, sin configuración o sin internet, simplemente no hacen nada.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  signInAnonymously,
  type Auth,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';

import { FIREBASE_CONFIG, FIREBASE_CONFIGURED } from './firebaseConfig';
import { entryId } from './profile';
import type { Saved } from './services';

export const cloudConfigured = FIREBASE_CONFIGURED;

export type RankRow = { id: string; name: string; best: number };

type Services = { auth: Auth; db: Firestore };
let services: Services | null | undefined;

/** Inicializa Firebase una sola vez (y tolera el "Fast Refresh" de desarrollo). */
function init(): Services | null {
  if (services !== undefined) {
    return services;
  }
  if (!FIREBASE_CONFIGURED) {
    return (services = null);
  }
  try {
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    let auth: Auth;
    let db: Firestore;
    try {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      auth = getAuth(app); // ya estaba inicializado
    }
    try {
      // Long polling: evita problemas de conexión de Firestore en React Native.
      db = initializeFirestore(app, { experimentalForceLongPolling: true });
    } catch {
      db = getFirestore(app);
    }
    services = { auth, db };
  } catch (error) {
    console.warn('[nube] no se pudo iniciar Firebase', error);
    services = null;
  }
  return services;
}

/** Id del documento del jugador actual (lo fija syncProfile); el ranking lo usa para resaltar "tú". */
let activeEntryId: string | null = null;

let uidPromise: Promise<string | null> | null = null;

/** uid del jugador (sesión anónima, persistente). null si no hay nube o no hay internet. */
export function signIn(): Promise<string | null> {
  uidPromise ??= (async () => {
    const s = init();
    if (!s) {
      return null;
    }
    await s.auth.authStateReady(); // espera a que se restaure la sesión guardada
    if (s.auth.currentUser) {
      return s.auth.currentUser.uid;
    }
    return (await signInAnonymously(s.auth)).user.uid;
  })().catch((error) => {
    console.warn('[nube] no se pudo iniciar sesión', error);
    uidPromise = null; // permite reintentar
    return null;
  });
  return uidPromise;
}

const displayName = (name: string) => name.trim().slice(0, 16) || 'Jugador';

/**
 * Refleja el perfil local en la nube: users/{entryId} y leaderboard/{entryId}.
 * Cada jugador (apodo) tiene sus propios documentos, así que al cambiar de apodo el anterior queda intacto.
 * El ranking se escribe siempre (también con récord 0) y oculta los 0 (ver `watchLeaderboard`).
 */
export async function syncProfile(saved: Saved) {
  try {
    const uid = await signIn();
    const s = init();
    if (!uid || !s) {
      return;
    }
    const name = displayName(saved.name);
    const id = entryId(uid, saved.playerId);
    activeEntryId = id;
    await setDoc(
      doc(s.db, 'users', id),
      { uid, playerId: saved.playerId, displayName: name, best: saved.best, mode: saved.mode, ultraUnlocked: saved.ultraUnlocked, pack: saved.pack, sounds: saved.sounds, sound: saved.sound, updatedAt: serverTimestamp() },
      { merge: true },
    );
    await setDoc(
      doc(s.db, 'leaderboard', id),
      { uid, displayName: name, best: saved.best, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    console.warn('[nube] no se pudo guardar el perfil', error);
  }
}

/** Registra la compra de prueba. Es un reporte de la app: no hay servidor que confirme el cobro. */
export async function recordPurchase(productId: string, amountMXN: number) {
  try {
    const uid = await signIn();
    const s = init();
    if (!uid || !s) {
      return;
    }
    await addDoc(collection(s.db, 'purchases'), {
      uid,
      productId,
      amountMXN,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[nube] no se pudo registrar la compra', error);
  }
}

/** Escucha en vivo el top 10 (sin jugadores en 0). Devuelve la función para dejar de escuchar. */
export function watchLeaderboard(
  onRows: (rows: RankRow[], myUid: string | null) => void,
  onError: () => void,
): () => void {
  let stop: (() => void) | undefined;
  let cancelled = false;

  signIn().then((uid) => {
    const s = init();
    if (cancelled) {
      return;
    }
    if (!uid || !s) {
      onError();
      return;
    }
    stop = onSnapshot(
      query(collection(s.db, 'leaderboard'), where('best', '>', 0), orderBy('best', 'desc'), limit(10)),
      (snapshot) =>
        onRows(
          snapshot.docs.map((d) => ({ id: d.id, name: String(d.data().displayName ?? 'Jugador'), best: Number(d.data().best ?? 0) })),
          activeEntryId ?? uid, // el 2.º dato identifica TU fila (el id del documento del jugador actual)
        ),
      (error) => {
        console.warn('[nube] error al leer el ranking', error);
        onError();
      },
    );
  });

  return () => {
    cancelled = true;
    stop?.();
  };
}
