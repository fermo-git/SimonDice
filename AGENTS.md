This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

---

# Proyecto: Simón dice con sensores (leer antes de modificar)

App pequeña hecha contra reloj: **sin Expo Router** (navegación por estado en `App.tsx`). Usa el **SDK de JavaScript de Firebase** (`firebase`, no `@react-native-firebase`), así que no necesita código nativo extra. Corre en Expo Go (menos las notificaciones, que requieren dev build).
Ver `README.md` para requisitos, estructura y límites conocidos. Reglas de este proyecto:
- Los **retos** viven en `src/game.ts`; para añadir uno, agrega un objeto a `CHALLENGES` (con `neutral` y `done`). Si es del pack de pago, marca `extra: true`: `App.tsx` solo los incluye en el pool cuando `saved.pack` es true. La memoria de un reto es `scratch` (tipo `Scratch`); si necesitas un campo nuevo, agrégalo a ese tipo.
- El magnetómetro se usa en el reto `compass` (cambio de dirección del campo terrestre); el antiguo reto del imán se quitó por poco fiable. No lo quites sin reemplazo: el proyecto exige 3 sensores.
- **Modos:** `MODES`, `ULTRA_UNLOCK_SCORE` y `unlocksUltra` están en `src/game.ts`. Ultra solo cuenta si `saved.ultraUnlocked` es true (`App.tsx` lo degrada a Difícil si no). `roundMs(score, id, mode)` recibe el modo, no un booleano. El guardado antiguo (`expert`, `pro`, `daily`) se migra en `useSaved`.
- **Umbrales de los retos:** viven en `THRESH` (`src/game.ts`); no pongas números sueltos en los retos. Súbelos para exigir más y bájalos para facilitar. Si cambias `compassCos`, recuerda que depende de la latitud (en México, 0.78 ≈ 77° de giro del cuerpo). Historial: la versión con valores más altos fue demasiado difícil para la persona; los actuales son intermedios.
- Las lecturas de sensores van a **refs**, no a estado (llegan ~20 veces por segundo).
- Stripe: el mínimo por cobro es **$10 MXN**, también en modo test. Hay dos productos, ambos en `src/products.ts`: Pack de retos extra (campo `pack`) y Pack de sonidos (campo `sounds`; el sonido elegido va en `sound`). El Modo experto ya no se vende: la dificultad es un selector gratis (`mode`: normal | hard | ultra) del inicio. Se pagan en `src/Checkout.tsx` (WebView que intercepta la redirección `SUCCESS_URL` de Stripe; requiere `react-native-webview` en el build). Si el WebView no existe, `buyProduct` en `src/services.ts` abre el navegador y pregunta "¿Completaste el pago?". `react-native-webview` se carga de forma diferida, no lo importes de forma estática; `recordPurchase(productId, monto)` en `src/cloud.ts` los registra.
- Las notificaciones son **locales** (`expo-notifications`); las push remotas no funcionan en Expo Go en Android.
- Antes de terminar una tarea: `npx tsc --noEmit`.
- **Firebase JS SDK, no el nativo:** el nativo obligaría a recompilar el dev build. La capa de datos está en `src/cloud.ts`; la configuración, en `src/firebaseConfig.ts`; las reglas, en `firestore.rules`.
- **La nube nunca debe romper el juego:** todas las funciones de `src/cloud.ts` atrapan sus errores y no hacen nada sin configuración o sin internet. El estado local manda; Firestore es un reflejo.
- `tsconfig.json` mapea `@firebase/auth` a sus tipos de React Native (si no, `getReactNativePersistence` no tiene tipos).
- **Interfaz:** las pantallas viven en `src/screens/` y los componentes compartidos en `src/ui.tsx` (botón con relieve `Btn`, `Card`, `Disc`). Estilo: el Simón de juguete, con los colores de `C` y bordes inferiores gruesos. Solo componentes de React Native, sin librerías de UI ni fuentes externas.
- **Sonidos:** la lista está en `SOUNDS` (`src/sound.ts`); para añadir uno, agrega el `.wav` a `assets/sounds/`, su entrada en `FILES` y en `SOUNDS` (`premium: true` si va en el pack). `App.tsx` calcula `soundId`: sin pack siempre suena `ding`.
- **Sonido:** `expo-audio` se carga de forma diferida en `src/sound.ts` (módulo nativo: necesita un build que lo incluya). No lo importes de forma estática. Tras `play()` hay que hacer `seekTo(0)` para repetir el sonido.
- **Recordatorio diario:** se eliminó de la interfaz; `App.tsx` solo cancela el que haya quedado programado de versiones anteriores.
- **Notificaciones:** `expo-notifications` se carga de forma diferida en `src/services.ts` porque en Expo Go (Android) lanza un error al importarse. No lo importes de forma estática.
