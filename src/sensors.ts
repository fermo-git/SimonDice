import { useEffect, useRef, useState } from 'react';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';

export type V3 = { x: number; y: number; z: number };
export type SensorKey = 'acc' | 'gyro' | 'mag';

const ZERO: V3 = { x: 0, y: 0, z: 0 };
const INTERVAL_MS = 50;

/**
 * Escucha los 3 sensores del juego. Las lecturas van a refs (no a estado)
 * porque llegan ~20 veces por segundo y no queremos re-renderizar cada vez.
 *  - acc  (acelerómetro): en g, ~1 g en reposo
 *  - gyro (giroscopio):   en rad/s
 *  - mag  (magnetómetro): en microteslas
 */
export function useSensors() {
  const acc = useRef<V3>(ZERO);
  const gyro = useRef<V3>(ZERO);
  const mag = useRef<V3>(ZERO);
  const [available, setAvailable] = useState<Record<SensorKey, boolean>>({
    acc: true,
    gyro: true,
    mag: true,
  });

  useEffect(() => {
    Accelerometer.setUpdateInterval(INTERVAL_MS);
    Gyroscope.setUpdateInterval(INTERVAL_MS);
    Magnetometer.setUpdateInterval(INTERVAL_MS);

    const subs = [
      Accelerometer.addListener((d) => (acc.current = d)),
      Gyroscope.addListener((d) => (gyro.current = d)),
      Magnetometer.addListener((d) => (mag.current = d)),
    ];

    Promise.all([
      Accelerometer.isAvailableAsync(),
      Gyroscope.isAvailableAsync(),
      Magnetometer.isAvailableAsync(),
    ]).then(([a, g, m]) => setAvailable({ acc: a, gyro: g, mag: m }));

    return () => subs.forEach((s) => s.remove());
  }, []);

  return { acc, gyro, mag, available };
}
