import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Checkout } from './src/Checkout';
import { recordPurchase, syncProfile } from './src/cloud';
import { CHALLENGES, unlocksUltra, type Mode } from './src/game';
import { PACK_PAYMENT_LINK, PACK_PRICE_MXN, PACK_PRODUCT_ID, SOUNDS_PAYMENT_LINK, SOUNDS_PRICE_MXN, SOUNDS_PRODUCT_ID } from './src/products';
import { Game } from './src/screens/Game';
import { Home } from './src/screens/Home';
import { Ranking } from './src/screens/Ranking';
import { Shop } from './src/screens/Shop';
import { useSensors } from './src/sensors';
import { isSoundId, type SoundId } from './src/sound';
import { buyProduct, notify, setDailyReminder, useSaved } from './src/services';
import { st } from './src/ui';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

type Screen = 'home' | 'game' | 'ranking' | 'shop';
type Checkout = { link: string; what: string; resolve: (paid: boolean) => void };

function Root() {
  const [saved, update] = useSaved();
  const sensors = useSensors();
  const [screen, setScreen] = useState<Screen>('home');
  const [gameId, setGameId] = useState(0); // cambiar la key reinicia la partida
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  // Al abrir la app: inicia sesión anónima y refleja el perfil local en la nube.
  const loaded = saved !== null;
  useEffect(() => {
    if (saved) {
      syncProfile(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // El recordatorio diario ya no existe en la app: cancela el que se haya programado en versiones anteriores.
  useEffect(() => {
    setDailyReminder(false).catch(() => undefined);
  }, []);

  if (!saved) {
    return <View style={st.fill} />;
  }

  /** Guarda en el teléfono y refleja el cambio en la nube. */
  const save = (patch: Partial<typeof saved>) => {
    update(patch);
    syncProfile({ ...saved, ...patch });
  };

  // Los retos extra solo salen si compró el pack, y solo si el teléfono tiene los sensores que piden.
  const pool = CHALLENGES.filter((c) => (!c.extra || saved.pack) && c.sensors.every((k) => sensors.available[k]));

  /** Pago dentro de la app (WebView). Sin WebView en el build, cae al navegador con la pregunta de respaldo. */
  const pay = (link: string, what: string) =>
    new Promise<boolean>((resolve) => {
      if (link.includes('REEMPLAZAR')) {
        buyProduct(link, what).then(resolve); // avisa que falta el link
        return;
      }
      setCheckout({ link, what, resolve });
    });

  // El sonido elegido solo cuenta si compró el pack; si no, siempre suena el "ding" gratis.
  // Ultra solo cuenta si está desbloqueado (p. ej. si se borraron los datos y quedó guardado como 'ultra').
  const mode: Mode = saved.mode === 'ultra' && !saved.ultraUnlocked ? 'hard' : saved.mode;

  const soundId: SoundId = saved.sounds && isSoundId(saved.sound) ? saved.sound : 'ding';

  const buySounds = async () => {
    if (await pay(SOUNDS_PAYMENT_LINK, 'el pack de sonidos')) {
      save({ sounds: true });
      recordPurchase(SOUNDS_PRODUCT_ID, SOUNDS_PRICE_MXN);
      notify('¡Pack de sonidos desbloqueado!', 'Elige tu sonido favorito en la Tienda.');
    }
  };

  const buyPack = async () => {
    if (await pay(PACK_PAYMENT_LINK, 'el pack de retos extra')) {
      save({ pack: true });
      recordPurchase(PACK_PRODUCT_ID, PACK_PRICE_MXN);
      notify('¡Pack de retos desbloqueado!', 'Ahora salen 4 retos nuevos en tus partidas.');
    }
  };

  let content;
  if (screen === 'game') {
    content = (
      <Game
        key={gameId}
        sensors={sensors}
        pool={pool}
        mode={mode}
        ultraUnlocked={saved.ultraUnlocked}
        best={saved.best}
        soundId={soundId}
        onFinish={(score) => {
          const unlock = unlocksUltra(mode, score, saved.ultraUnlocked);
          save({ last: score, best: Math.max(saved.best, score), ...(unlock ? { ultraUnlocked: true } : {}) });
          if (unlock) {
            notify('¡Modo Ultra desbloqueado!', `Conseguiste ${score} retos en Difícil. Actívalo en el inicio.`);
          } else if (score > saved.best && score > 0) {
            notify('¡Nuevo récord!', `Superaste ${score} retos seguidos.`);
          }
        }}
        onRestart={() => setGameId((n) => n + 1)}
        onExit={() => setScreen('home')}
      />
    );
  } else if (screen === 'ranking') {
    content = <Ranking myName={saved.name} onBack={() => setScreen('home')} />;
  } else if (screen === 'shop') {
    content = <Shop saved={saved} update={save} soundId={soundId} onBuyPack={buyPack} onBuySounds={buySounds} onBack={() => setScreen('home')} />;
  } else {
    content = (
      <Home
        saved={saved}
        update={save}
        available={sensors.available}
        mode={mode}
        canPlay={pool.length > 0}
        onPlay={() => setScreen('game')}
        onRanking={() => setScreen('ranking')}
        onShop={() => setScreen('shop')}
      />
    );
  }

  return (
    <>
      {content}
      {checkout && (
        <Checkout
          link={checkout.link}
          onDone={(paid) => {
            setCheckout(null);
            checkout.resolve(paid);
          }}
          onUnavailable={() => {
            setCheckout(null);
            buyProduct(checkout.link, checkout.what).then(checkout.resolve);
          }}
        />
      )}
    </>
  );
}
