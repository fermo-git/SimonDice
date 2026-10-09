/**
 * Sonidos de acierto. `expo-audio` se carga de forma diferida: si el build instalado no lo incluye
 * (módulo nativo), el juego sigue funcionando sin sonido (solo con vibración).
 *
 * "ding" es gratis; los otros tres vienen en el Pack de sonidos (se compra en la Tienda).
 */
type AudioModule = typeof import('expo-audio');
type Player = ReturnType<AudioModule['createAudioPlayer']>;

export type SoundId = 'ding' | 'moneda' | 'campana' | 'burbuja';

export const SOUNDS: { id: SoundId; name: string; icon: string; premium: boolean }[] = [
  { id: 'ding', name: 'Ding', icon: '🔔', premium: false },
  { id: 'moneda', name: 'Moneda', icon: '🪙', premium: true },
  { id: 'campana', name: 'Campana', icon: '🛎️', premium: true },
  { id: 'burbuja', name: 'Burbuja', icon: '🫧', premium: true },
];

const FILES: Record<SoundId, number> = {
  ding: require('../assets/sounds/correct.wav'),
  moneda: require('../assets/sounds/coin.wav'),
  campana: require('../assets/sounds/bell.wav'),
  burbuja: require('../assets/sounds/pop.wav'),
};

export const isSoundId = (id: string): id is SoundId => id in FILES;

let audio: AudioModule | null | undefined;
const players = new Map<SoundId, Player | null>();

function module_(): AudioModule | null {
  if (audio !== undefined) {
    return audio;
  }
  try {
    audio = require('expo-audio') as AudioModule;
    // Suena aunque el teléfono esté en modo silencio.
    audio.setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  } catch (error) {
    console.warn('[sonido] no disponible en este build; el juego sigue sin sonido.', error);
    audio = null;
  }
  return audio;
}

function load(id: SoundId): Player | null {
  if (players.has(id)) {
    return players.get(id) ?? null;
  }
  let player: Player | null = null;
  try {
    player = module_()?.createAudioPlayer(FILES[id]) ?? null;
  } catch (error) {
    console.warn('[sonido] no se pudo cargar', id, error);
  }
  players.set(id, player);
  return player;
}

/** Carga el sonido antes de jugar, para que el primer acierto no tenga retraso. */
export function preloadSounds(id: SoundId = 'ding') {
  load(id);
}

/** Reproduce un sonido (acierto o vista previa en la Tienda). Nunca lanza errores. */
export function playSound(id: SoundId = 'ding') {
  try {
    const p = load(id);
    if (p) {
      p.seekTo(0); // expo-audio no rebobina solo al terminar
      p.play();
    }
  } catch {
    // el sonido nunca debe romper el juego
  }
}
