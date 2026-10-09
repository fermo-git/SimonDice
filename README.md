# Simón dice con sensores

Juego móvil (Expo SDK 57, React Native, TypeScript). El teléfono pide acciones al azar con tiempo límite
("¡Agítalo!", "¡Voltéalo!", "¡Gíralo!"…) y el jugador debe cumplirlas usando el aparato. Cada ronda es más rápida.

## Requisitos del proyecto y dónde se cumplen
| Requisito | Dónde |
|---|---|
| **3 sensores** | Acelerómetro (agitar, voltear, inclinar, quieto), giroscopio (girar, quieto) y magnetómetro (imán). `src/sensors.ts`, `src/game.ts` |
| **Compras con Stripe** (modo test) | Modo experto: botón en Inicio abre el Payment Link. `src/services.ts` → `buyPro`, URL en `src/config.ts` |
| **Notificaciones** (locales) | Aviso al comprar, aviso de nuevo récord, recordatorio diario (8 pm) y botón de prueba. `src/services.ts` |

## Cómo correrlo
```bash
npm install
npx expo start
```
Escanea el QR con **Expo Go** (misma red Wi-Fi; si no, `npx expo start --tunnel`). No necesita dev build ni Firebase.
Los sensores solo funcionan en un teléfono físico.

## Configurar Stripe
1. En Stripe (modo **test**): producto de **pago único (One-off)** en **MXN, mínimo $10** (el mínimo aplica también en test).
2. Crea su **Payment Link** y pega la URL en `src/config.ts` → `PRO_PAYMENT_LINK`.
3. Tarjeta de prueba: `4242 4242 4242 4242`, fecha futura, CVC `123`.

## Decisiones y límites (para la defensa)
- **La compra es una simulación sin verificación en servidor:** al cerrar el navegador la app pregunta
  "¿Completaste el pago?" y desbloquea el modo experto. Es aceptable porque el cobro es de prueba; un
  producto real necesitaría un webhook que confirme el pago antes de desbloquear.
- El progreso (récord, modo experto, recordatorio) se guarda en el teléfono con AsyncStorage.
- Las notificaciones son **locales** (las programa la propia app). Las push remotas no funcionan en Expo Go
  en Android desde SDK 53 y requerirían un development build.
- Cada ronda mide tu postura "normal" en la cuenta regresiva inicial; por eso los retos se cumplen sin importar
  cómo sostengas el teléfono. Un reto solo cuenta después de pasar por su estado de reposo (evita aciertos gratis).
- Umbrales en `src/game.ts` (ajustables): agitar > 1 g de variación, girar > 4 rad/s, imán > 20 µT de diferencia.

## Estructura
```
App.tsx          pantallas: Inicio y Juego
src/config.ts    link de Stripe, precio y colores
src/sensors.ts   hook useSensors (3 sensores)
src/game.ts      definición de los retos, tiempos y selección
src/services.ts  guardado local, notificaciones y compra
```
