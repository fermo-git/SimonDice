# Simón dice con sensores

Juego móvil (Expo SDK 57, React Native, TypeScript). El teléfono pide acciones al azar con tiempo límite
("¡Agítalo!", "¡Voltéalo!", "¡Gíralo!"…) y el jugador debe cumplirlas usando el aparato. Cada ronda es más rápida.

## Requisitos del proyecto y dónde se cumplen
| Requisito | Dónde |
|---|---|
| **3 sensores** | Acelerómetro (agitar, voltear, inclinar, quieto), giroscopio (girar, quieto) y magnetómetro (¡Brújula!: al girar tu cuerpo, el teléfono ve cambiar la dirección del campo magnético terrestre). `src/sensors.ts`, `src/game.ts` |
| **Base de datos** (Firebase, nube) | Firestore con login anónimo: perfil, **ranking global** en vivo y compras. `src/cloud.ts`, reglas en `firestore.rules` |
| **Compras con Stripe** (modo test) | Dos productos en la Tienda: **Pack de retos extra** ($15, 4 retos nuevos) y **Pack de sonidos** ($10, 3 sonidos de acierto con selector). Links en `src/products.ts`. El antiguo *Modo experto* ya no se vende: ahora la dificultad es un selector gratis del inicio (ver *Modos de dificultad*). `src/services.ts` → `buyProduct` |
| **Notificaciones** (locales) | Aviso al comprar y aviso de nuevo récord. `src/services.ts` |
| **Sonido** | Un sonido al acertar cada reto: "ding" gratis y tres más en el Pack de sonidos, con vista previa y selector en la Tienda (`assets/sounds/*.wav`, `src/sound.ts`, con `expo-audio`). Si el build no lo incluye, el juego sigue con vibración |

## Cómo correrlo
```bash
npm install
npx expo start
```
Escanea el QR con **Expo Go** (misma red Wi-Fi; si no, `npx expo start --tunnel`). Los sensores solo funcionan en un teléfono físico.
Las **notificaciones** requieren un development build (en Expo Go están desactivadas y la app avisa); lo demás funciona en ambos.

## Configurar Stripe
0. Para el desbloqueo automático: en **cada** Payment Link → Editar → *Después del pago* → **No mostrar página de confirmación** → redirigir a `https://example.com/pago-ok` (debe coincidir con `SUCCESS_URL` en `src/Checkout.tsx`). Requiere `npx expo install react-native-webview` y un development build nuevo.
1. En Stripe (modo **test**): dos productos de **pago único (One-off)** en **MXN, mínimo $10** (el mínimo aplica también en test): *Pack de retos extra* ($15) y *Pack de sonidos* ($10).
2. Crea el **Payment Link** de cada uno y pégalos en `src/products.ts` → `PACK_PAYMENT_LINK` y `SOUNDS_PAYMENT_LINK`. (`PRO_PAYMENT_LINK` de `src/config.ts` ya no se usa y se puede borrar.) Si cambias un precio, cambia también su etiqueta.
3. Tarjeta de prueba: `4242 4242 4242 4242`, fecha futura, CVC `123`.

## Configurar Firebase (base de datos)
Usa el **SDK de JavaScript** (`firebase`), que funciona en Expo Go y en el dev build sin código nativo.
1. Consola de Firebase → crear proyecto (plan gratuito, sin Blaze).
2. **Firestore Database** → crear base de datos (modo producción) → pestaña **Reglas** → pegar `firestore.rules` → Publicar.
3. **Authentication** → Sign-in method → activar **Anónimo**.
4. ⚙️ Configuración del proyecto → Tus apps → **</> Web** → registrar → copiar la configuración a `src/firebaseConfig.ts`.
5. Reiniciar `npx expo start`. Sin configurar, la app funciona igual pero sin ranking ni respaldo en la nube.

### Modelo de datos
```
users/{uid}        displayName, best, mode, ultraUnlocked, pack, sounds, sound, updatedAt (solo lo lee/escribe su dueño)
leaderboard/{uid}  displayName, best, updatedAt                  (lectura: todos con sesión; escritura: su dueño, validada)
purchases/{id}     uid, productId ('pack_retos' | 'pack_sonidos'), amountMXN, createdAt (se crea a nombre propio; no se edita ni borra)
```
Cada instalación obtiene un uid con **autenticación anónima** (se conserva al cerrar la app; si se desinstala, cambia).
El ranking es el top 10 (`orderBy best desc, limit 10`) con `onSnapshot`, por eso se actualiza en vivo entre teléfonos.

## Modos de dificultad
Selector en el inicio (`src/screens/Home.tsx`). Definidos en `MODES` de `src/game.ts`:
| Modo | Tiempo por ronda | Pistas | Cómo se obtiene |
|---|---|---|---|
| Normal | 100 % | Sí | Siempre |
| Difícil | 75 % (25 % más rápido) | Sí | Siempre |
| 🔥 Ultra | 60 % (40 % más rápido) | **No** (solo emoji y verbo) | Se desbloquea al lograr **40 retos o más en una partida de modo Difícil** (`ULTRA_UNLOCK_SCORE`) |

El desbloqueo queda guardado en el teléfono y en la nube (`users/{uid}.ultraUnlocked`); al desbloquearlo llega una notificación local y la pantalla final lo anuncia. Jugar Ultra ya desbloqueado no vuelve a "desbloquear" nada. Los mínimos de tiempo de ¡Quieto!, ¡Brújula! y ¡Doble agitada! se respetan en todos los modos. Los datos guardados con el antiguo interruptor `expert` se migran solos (`expert: true` → Difícil). Para probar el desbloqueo sin jugar 40 rondas, baja temporalmente `ULTRA_UNLOCK_SCORE` en `src/game.ts` y vuelve a ponerlo en 40.

## Pack de retos extra
Cuatro retos que solo salen si el jugador compró el pack (`extra: true` en `src/game.ts`):
| Reto | Sensor | Detección |
|---|---|---|
| ¡Adelante! | Acelerómetro | Baja el borde de arriba: la lectura en y baja más de 0.6 g (≈ 37° de inclinación) respecto a tu postura inicial |
| ¡Atrás! | Acelerómetro | Lo contrario: la lectura en y sube más de 0.6 g |
| ¡Doble agitada! | Acelerómetro | Dos sacudidas (> 1.3 g de variación) con calma entre ambas y al menos 350 ms de separación (`DOUBLE_GAP_MS`) |
| ¡Volante! | Giroscopio | Giro dominante en el eje z (el de la pantalla) de más de 3.0 rad/s, en cualquier sentido |

⚠️ Los signos del eje y y los umbrales de estos retos se derivaron de la física y de una simulación, **no se han probado en un teléfono real**. Si Adelante y Atrás salen invertidos, intercambia sus condiciones `done`.

## Decisiones y límites (para la defensa)
- **La compra se confirma en el teléfono, no en un servidor:** el pago se abre dentro de la app (`src/Checkout.tsx`, WebView) y se desbloquea cuando Stripe redirige a `https://example.com/pago-ok`, que la app intercepta. Es más fiable que preguntar "¿ya pagaste?", pero sigue siendo una confirmación del cliente: un producto real necesitaría un webhook de Stripe. Si el build instalado no incluye `react-native-webview`, la app usa el navegador y vuelve a preguntar "¿Completaste el pago?" como respaldo.
- El progreso se guarda **primero en el teléfono** (AsyncStorage) y se **refleja en Firestore**; si no hay internet o Firebase no está configurado, el juego sigue funcionando (la nube nunca debe romperlo).
- La compra se registra en `purchases` desde la app, así que **tampoco la verifica un servidor**; un producto real usaría un webhook de Stripe que escriba esa colección.
- Las reglas impiden que un jugador escriba el puntaje de otro, pero un jugador motivado podría enviar un puntaje falso de sus propios datos (límite 500): aceptable en un proyecto escolar.
- Las notificaciones son **locales** (las programa la propia app). Las push remotas no funcionan en Expo Go
  en Android desde SDK 53 y requerirían un development build.
- Cada ronda mide tu postura "normal" en la cuenta regresiva inicial; por eso los retos se cumplen sin importar
  cómo sostengas el teléfono. Un reto solo cuenta después de pasar por su estado de reposo (evita aciertos gratis).
- Umbrales: están todos juntos en `THRESH`, al inicio de `src/game.ts`, con los valores de las dos versiones anteriores comentados. Actuales: agitar > 1.3 g de variación, inclinar > 0.6 g (≈ 37°), voltear a más de ≈ 134°, girar > 4.8 rad/s, volante > 3.0 rad/s y brújula > ≈ 39° de cambio en la dirección del campo magnético (≈ 77° de giro del cuerpo en México; en latitudes muy altas el campo es casi vertical y el reto se vuelve difícil). Historial: versión inicial fácil → una versión más exigente (1.5 g / 0.7 g / 5.5 / 3.5 / 85°) que resultó **demasiado difícil** → los valores actuales, intermedios. **Solo se probaron con simulación; el ajuste fino debe hacerse jugando en el teléfono.**

## Estructura
```
App.tsx          navegación por estado, compras y pago (orquesta las pantallas)
src/screens/     Home (disco tipo Simón), Game, Shop (tienda) y Ranking
src/ui.tsx       botón con relieve, tarjeta y disco de cuatro colores
src/sound.ts     sonidos de acierto: ding (gratis) + moneda, campana y burbuja (pack). expo-audio, carga diferida
src/config.ts    colores (y un PRO_PAYMENT_LINK que ya no se usa)
src/products.ts  links, precios e ids del Pack de retos extra y del Pack de sonidos
src/sensors.ts   hook useSensors (3 sensores)
src/game.ts      definición de los retos, tiempos y selección
src/cloud.ts      Firebase: sesión anónima, perfil, ranking y compras
src/firebaseConfig.ts  configuración de tu proyecto de Firebase
firestore.rules  reglas de seguridad de Firestore
src/services.ts  guardado local, notificaciones y compra
```
