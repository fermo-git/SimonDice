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
  scratch: { stillSince?: number };
};

export type Challenge = {
  id: string;
  verb: string;
  hint: string;
  sensorLabel: string;
  sensors: SensorKey[];
  color: string;
  /** Estado de "reposo": el reto solo cuenta después de pasar por aquí (evita aciertos gratis). */
  neutral: (c: Ctx) => boolean;
  done: (c: Ctx) => boolean;
};

const len = (v: V3) => Math.hypot(v.x, v.y, v.z);
const cos = (a: V3, b: V3) => (a.x * b.x + a.y * b.y + a.z * b.z) / (len(a) * len(b) || 1);

export const CHALLENGES: Challenge[] = [
  {
    id: 'shake',
    verb: '¡Agítalo!',
    hint: 'Sacúdelo fuerte de lado a lado',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.pink,
    neutral: (c) => Math.abs(len(c.a) - 1) < 0.2,
    done: (c) => Math.abs(len(c.a) - 1) > 1.0,
  },
  {
    id: 'flip',
    verb: '¡Voltéalo!',
    hint: 'Ponlo boca abajo',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.yellow,
    neutral: (c) => cos(c.a, c.base.a) > 0.6,
    done: (c) => cos(c.a, c.base.a) < -0.6,
  },
  {
    id: 'left',
    verb: '¡Izquierda!',
    hint: 'Inclínalo hacia la izquierda',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.sky,
    // En x el signo viene invertido: positivo = inclinado a la izquierda (igual que en TiltMaze).
    neutral: (c) => Math.abs(c.a.x - c.base.a.x) < 0.2,
    done: (c) => c.a.x - c.base.a.x > 0.5,
  },
  {
    id: 'right',
    verb: '¡Derecha!',
    hint: 'Inclínalo hacia la derecha',
    sensorLabel: 'Acelerómetro',
    sensors: ['acc'],
    color: C.orange,
    neutral: (c) => Math.abs(c.a.x - c.base.a.x) < 0.2,
    done: (c) => c.base.a.x - c.a.x > 0.5,
  },
  {
    id: 'spin',
    verb: '¡Gíralo!',
    hint: 'Hazlo girar rápido en tu mano',
    sensorLabel: 'Giroscopio',
    sensors: ['gyro'],
    color: C.violet,
    neutral: (c) => len(c.g) < 1,
    done: (c) => len(c.g) > 4,
  },
  {
    id: 'magnet',
    verb: '¡Imán!',
    hint: 'Acércalo a algo metálico o a otro teléfono',
    sensorLabel: 'Magnetómetro',
    sensors: ['mag'],
    color: C.mint,
    neutral: (c) => Math.abs(len(c.m) - c.base.m) < 10,
    done: (c) => Math.abs(len(c.m) - c.base.m) > 20,
  },
  {
    id: 'still',
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
];

/** Tiempo para cumplir el reto: baja con cada ronda; el modo experto lo reduce un 25 %. */
export function roundMs(score: number, id: string, expert: boolean) {
  const ms = Math.max(1800, 4200 - score * 130) * (expert ? 0.75 : 1);
  return id === 'still' ? Math.max(ms, 3300) : ms;
}

export function pickChallenge(pool: Challenge[], lastId: string) {
  const options = pool.filter((c) => c.id !== lastId);
  return options[Math.floor(Math.random() * options.length)] ?? pool[0];
}
