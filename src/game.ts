import { C } from './config';
import type { SensorKey, V3 } from './sensors';

/** Todo lo que un reto necesita para decidir si se cumplió. */
export type Ctx = {
  a: V3; // acelerómetro (g)
  g: V3; // giroscopio (rad/s)
  m: V3; // magnetómetro (µT)
  /** Postura y campo magnético "normales", medidos antes de empezar. */
  base: { a: V3; m: number };
  now: number;
  /** Memoria del reto en curso (se borra en cada ronda). */
  scratch: Scratch;
};

export type Scratch = {
  stillSince?: number; // ¡Quieto!
  hits?: number; // ¡Doble agitada!: sacudidas contadas
  lastHitAt?: number;
  calm?: boolean; // ¡Doble agitada!: volvió a la calma desde la última sacudida
  ref?: V3; // ¡Brújula!: campo magnético de referencia, medido cuando el teléfono estaba quieto
};

export type Challenge = {
  id: string;
  icon: string; // emoji grande de la pantalla del reto
  verb: string;
  hint: string;
  sensorLabel: string;
  sensors: SensorKey[];
  color: string;
  /** true = pertenece al pack de retos extra (solo sale si el jugador lo compró). */
  extra?: boolean;
  /** Estado de "reposo": el reto solo cuenta después de pasar por aquí (evita aciertos gratis). */
  neutral: (c: Ctx) => boolean;
  done: (c: Ctx) => boolean;
};

/** ¡Adelante!/¡Atrás!: margen (grados) para considerar que vuelves a tu postura. Debe ser bastante menor que `THRESH.pitch`. */
const NEUTRAL_PITCH = 8;

/** Mínimo entre dos sacudidas para que cuenten como dos (ajustable). */
const DOUBLE_GAP_MS = 350;

/**
 * Cuánto hay que exagerar cada movimiento. Súbelo para exigir más, bájalo para facilitar.
 * Entre paréntesis: (original fácil → versión más exigente que se probó y resultó demasiado dura).
 */
export const THRESH = {
  shake: 1.3, //        variación de la aceleración total en g (1.0 → 1.5): una sacudida fuerte, sin exagerar
  doubleShake: 1.3, //  igual, para cada una de las dos sacudidas (1.0 → 1.5)
  tilt: 0.6, //         izquierda/derecha, en g ≈ 37° de inclinación (0.5 ≈ 30° → 0.7 ≈ 44°)
  flipCos: -0.7, //     voltear: coseno respecto a tu postura ≈ 134° de giro (-0.6 ≈ 127° → -0.8 ≈ 143°)
  spin: 4.8, //         ¡Gíralo!: velocidad angular total en rad/s (4 → 5.5)
  wheel: 3.0, //        ¡Volante!: velocidad angular en el eje z en rad/s (2.5 → 3.5)
  pitch: 15, //         ¡Adelante!/¡Atrás!: grados de inclinación hacia adelante/atrás respecto a tu postura (20 → 15; al inicio usaban `tilt`, que no llegaba)
  compassCos: 0.78, //  ¡Brújula!: coseno del cambio del campo ≈ 39°, o sea ≈ 77° de giro del cuerpo en México (0.866 ≈ 58° → 0.74 ≈ 85°)
};

const len = (v: V3) => Math.hypot(v.x, v.y, v.z);
/**
 * Inclinación adelante/atrás en grados, medida en el plano y–z del acelerómetro (0 = plano boca arriba, 90 = parado).
 * Se mide como ángulo y no como la lectura de y: con el teléfono casi parado, y ya vale ~1 g y casi no cambia
 * (y = sen φ), así que "inclinar atrás" nunca alcanzaba el umbral en g.
 */
const pitchDeg = (a: V3) => (Math.atan2(a.y, a.z) * 180) / Math.PI;
/** Cuántos grados se inclinó respecto a tu postura inicial (positivo = borde de arriba hacia ti; negativo = hacia adelante). */
const pitchDelta = (c: Ctx) => (((pitchDeg(c.a) - pitchDeg(c.base.a) + 180) % 360) + 360) % 360 - 180;
const cos = (a: V3, b: V3) => (a.x * b.x + a.y * b.y + a.z * b.z) / (len(a) * len(b) || 1);

export const CHALLENGES: Challenge[] = [
  {
    id: 'shake',
    icon: '📳',
    verb: '¡Agítalo!',
    hint: 'Sacúdelo fuerte de lado a lado',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.pink,
    neutral: (c) => Math.abs(len(c.a) - 1) < 0.2,
    done: (c) => Math.abs(len(c.a) - 1) > THRESH.shake,
  },
  {
    id: 'flip',
    icon: '🙃',
    verb: '¡Voltéalo!',
    hint: 'Ponlo boca abajo',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.yellow,
    neutral: (c) => cos(c.a, c.base.a) > 0.6,
    done: (c) => cos(c.a, c.base.a) < THRESH.flipCos,
  },
  {
    id: 'left',
    icon: '⬅️',
    verb: '¡Izquierda!',
    hint: 'Inclínalo bien hacia la izquierda',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.sky,
    // En x el signo viene invertido: positivo = inclinado a la izquierda (igual que en TiltMaze).
    neutral: (c) => Math.abs(c.a.x - c.base.a.x) < 0.2,
    done: (c) => c.a.x - c.base.a.x > THRESH.tilt,
  },
  {
    id: 'right',
    icon: '➡️',
    verb: '¡Derecha!',
    hint: 'Inclínalo bien hacia la derecha',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.orange,
    neutral: (c) => Math.abs(c.a.x - c.base.a.x) < 0.2,
    done: (c) => c.base.a.x - c.a.x > THRESH.tilt,
  },
  {
    id: 'spin',
    icon: '🌀',
    verb: '¡Gíralo!',
    hint: 'Hazlo girar rápido en tu mano',
    sensorLabel: 'Giroscopio',
    sensors: ['gyro'],
    color: C.violet,
    neutral: (c) => len(c.g) < 1,
    done: (c) => len(c.g) > THRESH.spin,
  },
  {
    // Reemplaza al antiguo "¡Imán!": ese dependía de tener un imán o bocina a mano y era poco fiable.
    // El campo magnético de la Tierra es fijo; al girar tu cuerpo, el teléfono lo ve cambiar de dirección.
    id: 'compass',
    icon: '🧭',
    verb: '¡Brújula!',
    hint: 'Gira tu cuerpo un cuarto de vuelta con el teléfono en la mano',
    sensorLabel: 'Magnetómetro',
    sensors: ['mag'],
    color: C.mint,
    // Toma la referencia en un momento de calma (no depende de cómo lo sostuviste al empezar la partida).
    neutral: (c) => {
      if (len(c.g) < 0.8 && len(c.m) > 0) {
        c.scratch.ref = c.m;
        return true;
      }
      return false;
    },
    // Cambio de dirección > ~39° respecto a la referencia (un poco menos de un cuarto de vuelta del cuerpo). Inclinar el teléfono también lo provoca: es normal.
    done: (c) => (c.scratch.ref ? cos(c.m, c.scratch.ref) < THRESH.compassCos : false),
  },
  {
    id: 'still',
    icon: '✋',
    verb: '¡Quieto!',
    hint: 'Mantenlo inmóvil por un momento',
    sensorLabel: 'Giroscopio y acelerómetro',
    sensors: ['acc', 'gyro'],
    color: C.sky,
    neutral: () => true,
    done: (c) => {
      const calm = len(c.g) < 0.3 && Math.abs(len(c.a) - 1) < 0.05;
      if (!calm) {
        c.scratch.stillSince = undefined;
        return false;
      }
      c.scratch.stillSince ??= c.now;
      return c.now - c.scratch.stillSince > 1500;
    },
  },
  {
    id: 'forward',
    icon: '⏬',
    extra: true,
    verb: '¡Adelante!',
    hint: 'Baja bien la parte de arriba del teléfono, como empujándolo',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.orange,
    // Al bajar el borde de arriba, el ángulo de cabeceo disminuye (convención Android, como el signo de x).
    // ⚠️ Signo sin probar en teléfono: si sale al revés, intercambia forward y back.
    neutral: (c) => Math.abs(pitchDelta(c)) < NEUTRAL_PITCH,
    done: (c) => pitchDelta(c) < -THRESH.pitch,
  },
  {
    id: 'back',
    icon: '⏫',
    extra: true,
    verb: '¡Atrás!',
    hint: 'Sube bien la parte de arriba del teléfono, hacia ti',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.violet,
    neutral: (c) => Math.abs(pitchDelta(c)) < NEUTRAL_PITCH,
    done: (c) => pitchDelta(c) > THRESH.pitch,
  },
  {
    id: 'double',
    icon: '💥',
    extra: true,
    verb: '¡Doble agitada!',
    hint: 'Dos sacudidas fuertes, con una pausa corta',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.pink,
    neutral: (c) => Math.abs(len(c.a) - 1) < 0.2,
    done: (c) => {
      const dev = Math.abs(len(c.a) - 1);
      const s = c.scratch;
      s.calm ??= true;
      if (dev < 0.35) {
        s.calm = true;
      }
      // Una sacudida cuenta solo si antes hubo calma y pasó un mínimo desde la anterior.
      if (dev > THRESH.doubleShake && s.calm && (s.lastHitAt === undefined || c.now - s.lastHitAt > DOUBLE_GAP_MS)) {
        s.calm = false;
        s.hits = (s.hits ?? 0) + 1;
        s.lastHitAt = c.now;
      }
      return (s.hits ?? 0) >= 2;
    },
  },
  {
    id: 'wheel',
    icon: '🔄',
    extra: true,
    verb: '¡Volante!',
    hint: 'Gíralo plano, como un volante, hacia cualquier lado',
    sensorLabel: 'Giroscopio',
    sensors: ['gyro'],
    color: C.mint,
    neutral: (c) => len(c.g) < 1,
    // Giro dominante alrededor del eje z (el de la pantalla); sirve en ambos sentidos.
    done: (c) => Math.abs(c.g.z) > THRESH.wheel && Math.abs(c.g.z) > 2 * Math.max(Math.abs(c.g.x), Math.abs(c.g.y)),
  },
];

// ───────── Modos de dificultad ─────────
export type Mode = 'normal' | 'hard' | 'ultra';

/** `factor` multiplica el tiempo de cada ronda (menor = más rápido). `hints`: si se muestra la pista del reto. */
export const MODES: Record<Mode, { name: string; factor: number; hints: boolean; blurb: string }> = {
  normal: { name: 'Normal', factor: 1, hints: true, blurb: 'Tiempo normal, con pistas.' },
  hard: { name: 'Difícil', factor: 0.75, hints: true, blurb: 'Los retos llegan un 25 % más rápido.' },
  ultra: { name: 'Ultra', factor: 0.6, hints: false, blurb: 'Un 40 % más rápido y sin pistas.' },
};

/** Retos que hay que lograr en una partida de modo Difícil para desbloquear el modo Ultra. */
export const ULTRA_UNLOCK_SCORE = 40;

/** ¿Esta partida desbloquea el modo Ultra? Solo cuenta jugando en Difícil y si aún no estaba desbloqueado. */
export const unlocksUltra = (mode: Mode, score: number, alreadyUnlocked: boolean) =>
  !alreadyUnlocked && mode === 'hard' && score >= ULTRA_UNLOCK_SCORE;

/** Tiempo para cumplir el reto: baja con cada ronda y se multiplica por el factor del modo. */
export function roundMs(score: number, id: string, mode: Mode) {
  const ms = Math.max(1800, 4200 - score * 130) * MODES[mode].factor;
  if (id === 'still') {
    return Math.max(ms, 3300);
  }
  if (id === 'compass') {
    return Math.max(ms, 2600);
  }
  return id === 'double' ? Math.max(ms, 2800) : ms;
}

export function pickChallenge(pool: Challenge[], lastId: string) {
  const options = pool.filter((c) => c.id !== lastId);
  return options[Math.floor(Math.random() * options.length)] ?? pool[0];
}
