import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

import type { Mode } from './game';

// ───────── Progreso guardado en el teléfono ─────────
export type Saved = {
  name: string;
  playerId: string; // identifica a este jugador en la nube ('' = el de antes de existir esta función). Cada apodo nuevo = jugador nuevo
  mode: Mode; // dificultad elegida: normal | hard | ultra
  ultraUnlocked: boolean; // ya logró los puntos en Difícil para abrir el modo Ultra
  pack: boolean; // compró el Pack de retos extra
  sounds: boolean; // compró el Pack de sonidos
  sound: string; // sonido de acierto elegido (solo cuenta si compró el pack; si no, 'ding')
  best: number;
  last: number | null;
};
const DEFAULTS: Saved = { name: '', playerId: '', mode: 'normal', ultraUnlocked: false, pack: false, sounds: false, sound: 'ding', best: 0, last: null };
const KEY = 'simon-sensores:v1';

export function useSaved() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const ref = useRef<Saved>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const stored = raw ? JSON.parse(raw) : {};
        // Migración: antes la dificultad era un interruptor `expert` (y existía `pro`/`daily`).
        if (stored.mode === undefined && typeof stored.expert === 'boolean') {
          stored.mode = stored.expert ? 'hard' : 'normal';
        }
        delete stored.expert;
        delete stored.pro;
        delete stored.daily;
        ref.current = { ...DEFAULTS, ...stored };
      })
      .catch(() => undefined)
      .finally(() => setSaved(ref.current));
  }, []);

  const update = useCallback((patch: Partial<Saved>) => {
    ref.current = { ...ref.current, ...patch };
    setSaved(ref.current);
    AsyncStorage.setItem(KEY, JSON.stringify(ref.current)).catch(() => undefined);
  }, []);

  return [saved, update] as const;
}

// ───────── Notificaciones locales ─────────
type NotificationsModule = typeof import('expo-notifications');
let cached: NotificationsModule | null | undefined;

/**
 * Carga `expo-notifications` solo cuando se necesita.
 * En Expo Go (Android) ese módulo lanza un error al importarse, y un import normal
 * impediría que la app abriera. Con la carga diferida la app siempre abre y las
 * notificaciones funcionan en un development build (Expo Go las desactiva).
 */
function notifications(): NotificationsModule | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    const mod = require('expo-notifications') as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true, // en Android, sin sonido no se muestra el aviso emergente
        shouldSetBadge: false,
      }),
    });
    cached = mod;
  } catch (error) {
    console.warn('[notificaciones] no disponibles en Expo Go; usa un development build.', error);
    cached = null;
  }
  return cached;
}

/** false en Expo Go (Android): ahí las notificaciones no existen. */
export const notificationsAvailable = () => notifications() !== null;

async function ensurePermission(N: NotificationsModule) {
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('default', {
      name: 'General',
      importance: N.AndroidImportance.DEFAULT,
    });
  }
  const current = await N.getPermissionsAsync();
  return current.granted || (await N.requestPermissionsAsync()).granted;
}

/** Notificación inmediata (sin retraso) o con retraso en segundos. false si no se pudo. */
export async function notify(title: string, body: string, afterSeconds?: number) {
  const N = notifications();
  if (!N || !(await ensurePermission(N))) {
    return false;
  }
  await N.scheduleNotificationAsync({
    content: { title, body },
    trigger: afterSeconds
      ? { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: afterSeconds }
      : null,
  });
  return true;
}

/** Recordatorio diario a las 20:00. false si no hay notificaciones o se negó el permiso. */
export async function setDailyReminder(on: boolean) {
  const N = notifications();
  if (!N) {
    return false;
  }
  await N.cancelScheduledNotificationAsync('daily-reminder').catch(() => undefined);
  if (!on) {
    return true;
  }
  if (!(await ensurePermission(N))) {
    return false;
  }
  await N.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: { title: 'Simón dice', body: '¿Cuántos retos aguantas hoy? Toca para jugar.' },
    trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0 },
  });
  return true;
}

// ───────── Compra (Stripe, modo test) ─────────
/**
 * Abre un Payment Link y, al cerrar el navegador, pregunta si se completó el pago.
 * Es una simulación: no hay servidor que verifique el cobro (las compras son de prueba).
 * `what` completa la frase "desbloqueamos …" del aviso.
 */
export async function buyProduct(link: string, what: string): Promise<boolean> {
  if (link.includes('REEMPLAZAR')) {
    Alert.alert('Falta el link de Stripe', 'Pega la URL del Payment Link de este producto en el código (src/config.ts o src/products.ts).');
    return false;
  }
  await WebBrowser.openBrowserAsync(link);
  return new Promise((resolve) => {
    Alert.alert(
      '¿Completaste el pago?',
      `Si pagaste con la tarjeta de prueba, desbloqueamos ${what}.`,
      [
        { text: 'Todavía no', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sí, ya pagué', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

