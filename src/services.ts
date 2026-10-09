import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

import { PRO_PAYMENT_LINK } from './config';

// ───────── Progreso guardado en el teléfono ─────────
export type Saved = { pro: boolean; expert: boolean; best: number; last: number | null; daily: boolean };
const DEFAULTS: Saved = { pro: false, expert: false, best: 0, last: null, daily: false };
const KEY = 'simon-sensores:v1';

export function useSaved() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const ref = useRef<Saved>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        ref.current = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
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
 * Abre el Payment Link y, al cerrar el navegador, pregunta si se completó el pago.
 * Es una simulación: no hay servidor que verifique el cobro (las compras son de prueba).
 */
export async function buyPro(): Promise<boolean> {
  await WebBrowser.openBrowserAsync(PRO_PAYMENT_LINK);
  return new Promise((resolve) => {
    Alert.alert(
      '¿Completaste el pago?',
      'Si pagaste con la tarjeta de prueba, desbloqueamos el modo experto.',
      [
        { text: 'Todavía no', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sí, ya pagué', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
