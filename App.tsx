import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, PRO_PRICE_LABEL } from './src/config';
import { CHALLENGES, pickChallenge, roundMs, type Challenge } from './src/game';
import { useSensors, type SensorKey, type V3 } from './src/sensors';
import { buyPro, notificationsAvailable, notify, setDailyReminder, useSaved, type Saved } from './src/services';

const NO_NOTIFICATIONS = 'Las notificaciones no funcionan en Expo Go. Instala el development build para usarlas.';

type Sensors = ReturnType<typeof useSensors>;

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [saved, update] = useSaved();
  const sensors = useSensors();
  const [playing, setPlaying] = useState(false);
  const [gameId, setGameId] = useState(0); // cambiar la key reinicia la partida

  if (!saved) {
    return <View style={s.fill} />;
  }

  const pool = CHALLENGES.filter((c) => c.sensors.every((k) => sensors.available[k]));

  if (playing) {
    return (
      <Game
        key={gameId}
        sensors={sensors}
        pool={pool}
        expert={saved.pro && saved.expert}
        best={saved.best}
        onFinish={(score) => {
          update({ last: score, best: Math.max(saved.best, score) });
          if (score > saved.best && score > 0) {
            notify('¡Nuevo récord!', `Superaste ${score} retos seguidos.`);
          }
        }}
        onRestart={() => setGameId((n) => n + 1)}
        onExit={() => setPlaying(false)}
      />
    );
  }

  return <Home saved={saved} update={update} sensors={sensors} canPlay={pool.length > 0} onPlay={() => setPlaying(true)} />;
}

// ───────────────────────── Inicio ─────────────────────────
const SENSOR_NAMES: Record<SensorKey, string> = { acc: 'Acelerómetro', gyro: 'Giroscopio', mag: 'Magnetómetro' };

function Home(props: {
  saved: Saved;
  update: (patch: Partial<Saved>) => void;
  sensors: Sensors;
  canPlay: boolean;
  onPlay: () => void;
}) {
  const { saved, update, sensors, canPlay, onPlay } = props;
  const insets = useSafeAreaInsets();

  const onBuy = async () => {
    if (await buyPro()) {
      update({ pro: true, expert: true });
      notify('¡Modo experto desbloqueado!', 'Gracias por tu compra de prueba.');
    }
  };

  const onDaily = async (on: boolean) => {
    if (!notificationsAvailable()) {
      Alert.alert('Notificaciones no disponibles', NO_NOTIFICATIONS);
      return;
    }
    const ok = await setDailyReminder(on);
    update({ daily: ok && on });
    if (!ok) {
      Alert.alert('Permiso necesario', 'Activa las notificaciones de la app en los ajustes del teléfono.');
    }
  };

  const onTestNotification = async () => {
    if (!notificationsAvailable()) {
      Alert.alert('Notificaciones no disponibles', NO_NOTIFICATIONS);
      return;
    }
    if (await notify('Simón dice', '¡Así se ven las notificaciones!', 5)) {
      Alert.alert('Listo', 'Llegará en 5 segundos. Puedes salir de la app para verla.');
    }
  };

  return (
    <ScrollView
      style={s.fill}
      contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 20 }}>
      <View>
        <Text style={s.title}>Simón dice</Text>
        <Text style={s.lead}>Obedece al teléfono antes de que se acabe el tiempo.</Text>
      </View>

      <View style={s.row}>
        <Stat label="Récord" value={saved.best} />
        <Stat label="Última partida" value={saved.last ?? '—'} />
      </View>

      <View style={s.pills}>
        {(Object.keys(SENSOR_NAMES) as SensorKey[]).map((k) => (
          <Text key={k} style={[s.pill, !sensors.available[k] && s.pillOff]}>
            {sensors.available[k] ? '✓' : '✕'} {SENSOR_NAMES[k]}
          </Text>
        ))}
      </View>

      <Pressable style={[s.play, !canPlay && { opacity: 0.4 }]} disabled={!canPlay} onPress={onPlay}>
        <Text style={s.playText}>Jugar</Text>
      </Pressable>

      <View style={s.card}>
        {saved.pro ? (
          <Row label="Modo experto" hint="Retos un 25 % más rápidos" value={saved.expert} onChange={(v) => update({ expert: v })} />
        ) : (
          <>
            <Text style={s.cardTitle}>Modo experto</Text>
            <Text style={s.cardText}>Retos un 25 % más rápidos para quien ya domina el juego.</Text>
            <Pressable style={s.buy} onPress={onBuy}>
              <Text style={s.buyText}>Desbloquear por {PRO_PRICE_LABEL}</Text>
            </Pressable>
            <Text style={s.fine}>Compra de prueba con Stripe: no se cobra dinero real.</Text>
          </>
        )}
      </View>

      <View style={s.card}>
        <Row label="Recordatorio diario" hint="Un aviso a las 8 pm para jugar" value={saved.daily} onChange={onDaily} />
        <Pressable onPress={onTestNotification}>
          <Text style={s.link}>Probar una notificación en 5 segundos</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Row(props: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{props.label}</Text>
        <Text style={s.cardText}>{props.hint}</Text>
      </View>
      <Switch value={props.value} onValueChange={props.onChange} trackColor={{ true: C.mint, false: C.inkSoft }} thumbColor={C.paper} />
    </View>
  );
}

// ───────────────────────── Juego ─────────────────────────
type Phase = 'ready' | 'playing' | 'between' | 'over';
const ZERO: V3 = { x: 0, y: 0, z: 0 };
const len = (v: V3) => Math.hypot(v.x, v.y, v.z);

function Game(props: {
  sensors: Sensors;
  pool: Challenge[];
  expert: boolean;
  best: number;
  onFinish: (score: number) => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const { sensors, pool, expert, best, onFinish, onRestart, onExit } = props;
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(3);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [score, setScore] = useState(0);
  const bar = useRef(new Animated.Value(1)).current;

  // Estado mutable del juego: cambia 20 veces por segundo, no debe provocar renders.
  const g = useRef({
    phase: 'ready' as Phase,
    t0: Date.now(),
    until: 0,
    deadline: 0,
    armed: false,
    score: 0,
    lastId: '',
    challenge: null as Challenge | null,
    scratch: {} as { stillSince?: number },
    sumA: ZERO,
    sumM: 0,
    n: 0,
    base: { a: { x: 0, y: 0, z: 1 } as V3, m: 50 },
  }).current;

  useEffect(() => {
    const goTo = (p: Phase) => {
      g.phase = p;
      setPhase(p);
    };

    const startRound = () => {
      const next = pickChallenge(pool, g.lastId);
      const ms = roundMs(g.score, next.id, expert);
      g.challenge = next;
      g.lastId = next.id;
      g.armed = false;
      g.scratch = {};
      g.deadline = Date.now() + ms;
      setChallenge(next);
      goTo('playing');
      bar.setValue(1);
      Animated.timing(bar, { toValue: 0, duration: ms, easing: Easing.linear, useNativeDriver: false }).start();
    };

    const tick = () => {
      const now = Date.now();
      const a = sensors.acc.current;
      const gy = sensors.gyro.current;
      const m = sensors.mag.current;

      if (g.phase === 'ready') {
        const elapsed = now - g.t0;
        setCount(Math.max(1, 3 - Math.floor(elapsed / 1000)));
        if (elapsed > 1200) {
          // El último tramo de la cuenta regresiva sirve para medir tu postura "normal".
          g.sumA = { x: g.sumA.x + a.x, y: g.sumA.y + a.y, z: g.sumA.z + a.z };
          g.sumM += len(m);
          g.n += 1;
        }
        if (elapsed >= 3000) {
          if (g.n > 0 && len(g.sumA) > 0) {
            g.base = { a: { x: g.sumA.x / g.n, y: g.sumA.y / g.n, z: g.sumA.z / g.n }, m: g.sumM / g.n };
          }
          startRound();
        }
      } else if (g.phase === 'between') {
        if (now >= g.until) startRound();
      } else if (g.phase === 'playing' && g.challenge) {
        const ctx = { a, g: gy, m, base: g.base, now, scratch: g.scratch };
        if (now > g.deadline) {
          bar.stopAnimation();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          goTo('over');
          onFinish(g.score);
        } else if (!g.armed) {
          g.armed = g.challenge.neutral(ctx);
        } else if (g.challenge.done(ctx)) {
          g.score += 1;
          setScore(g.score);
          g.until = now + 700;
          bar.stopAnimation();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          goTo('between');
        }
      }
    };

    const id = setInterval(tick, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = phase === 'playing' && challenge ? challenge.color : C.ink;
  const textColor = phase === 'playing' ? C.ink : C.paper;

  return (
    <View style={[s.fill, { backgroundColor: bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.gameTop}>
        <Pressable onPress={onExit} hitSlop={12}>
          <Text style={[s.back, { color: textColor }]}>Salir</Text>
        </Pressable>
        <Text style={[s.back, { color: textColor }]}>Retos: {score}</Text>
      </View>

      <View style={s.center}>
        {phase === 'ready' && (
          <>
            <Text style={[s.hint, { color: C.muted }]}>Sostén el teléfono como vas a jugar</Text>
            <Text style={s.count}>{count}</Text>
          </>
        )}
        {phase === 'playing' && challenge && (
          <>
            <Text style={[s.verb, { color: C.ink }]}>{challenge.verb}</Text>
            <Text style={[s.hint, { color: C.ink }]}>{challenge.hint}</Text>
            <Text style={s.chip}>{challenge.sensorLabel}</Text>
          </>
        )}
        {phase === 'between' && <Text style={[s.verb, { color: C.mint }]}>¡Bien!</Text>}
        {phase === 'over' && (
          <>
            <Text style={[s.verb, { color: C.paper }]}>Se acabó el tiempo</Text>
            <Text style={[s.hint, { color: C.muted }]}>
              Lograste {score} {score === 1 ? 'reto' : 'retos'}. Tu récord es {Math.max(best, score)}.
            </Text>
            <Pressable style={[s.play, { marginTop: 32, alignSelf: 'stretch' }]} onPress={onRestart}>
              <Text style={s.playText}>Jugar otra vez</Text>
            </Pressable>
            <Pressable onPress={onExit} style={{ marginTop: 16 }}>
              <Text style={s.link}>Volver al inicio</Text>
            </Pressable>
          </>
        )}
      </View>

      {phase === 'playing' && (
        <View style={s.track}>
          <Animated.View style={[s.fillBar, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
      )}
    </View>
  );
}

// ───────────────────────── Estilos ─────────────────────────
const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.ink },
  title: { color: C.paper, fontSize: 46, fontWeight: '900' },
  lead: { color: C.muted, fontSize: 17, marginTop: 6, lineHeight: 24 },
  row: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: C.inkSoft, borderRadius: 18, padding: 16 },
  statValue: { color: C.yellow, fontSize: 34, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 14, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { color: C.mint, backgroundColor: C.inkSoft, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, overflow: 'hidden' },
  pillOff: { color: C.pink },
  play: { backgroundColor: C.yellow, borderRadius: 22, paddingVertical: 20, alignItems: 'center' },
  playText: { color: C.ink, fontSize: 24, fontWeight: '900' },
  card: { backgroundColor: C.inkSoft, borderRadius: 20, padding: 18, gap: 10 },
  cardTitle: { color: C.paper, fontSize: 18, fontWeight: '700' },
  cardText: { color: C.muted, fontSize: 15, lineHeight: 21 },
  buy: { backgroundColor: C.mint, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buyText: { color: C.ink, fontSize: 16, fontWeight: '800' },
  fine: { color: C.muted, fontSize: 12 },
  link: { color: C.sky, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gameTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24 },
  back: { fontSize: 18, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  verb: { fontSize: 58, fontWeight: '900', lineHeight: 64 },
  hint: { fontSize: 20, marginTop: 12, lineHeight: 28 },
  count: { color: C.yellow, fontSize: 140, fontWeight: '900', marginTop: 8 },
  chip: { alignSelf: 'flex-start', marginTop: 28, backgroundColor: C.ink, color: C.paper, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, fontSize: 14, fontWeight: '600', overflow: 'hidden' },
  track: { height: 14, marginHorizontal: 24, borderRadius: 7, backgroundColor: 'rgba(27,19,64,0.18)', overflow: 'hidden' },
  fillBar: { height: '100%', backgroundColor: C.ink, borderRadius: 7 },
});
