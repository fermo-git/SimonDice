import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '../config';
import { MODES, pickChallenge, roundMs, type Challenge, type Mode, type Scratch } from '../game';
import type { useSensors, V3 } from '../sensors';
import { playSound, preloadSounds, type SoundId } from '../sound';
import { Btn, st } from '../ui';

type Phase = 'ready' | 'playing' | 'between' | 'over';
const ZERO: V3 = { x: 0, y: 0, z: 0 };
const len = (v: V3) => Math.hypot(v.x, v.y, v.z);
const INK_SOFT_ON_COLOR = 'rgba(20,12,51,0.16)';

export function Game(props: {
  sensors: ReturnType<typeof useSensors>;
  pool: Challenge[];
  mode: Mode;
  ultraUnlocked: boolean;
  best: number;
  soundId: SoundId;
  onFinish: (score: number) => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const { sensors, pool, mode, ultraUnlocked, best, soundId, onFinish, onRestart, onExit } = props;
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(3);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [score, setScore] = useState(0);
  const bar = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const countPop = useRef(new Animated.Value(1)).current;
  const startBest = useRef(best).current; // récord al empezar: para saber si esta partida lo superó
  const startUltra = useRef(ultraUnlocked).current;
  const justUnlocked = ultraUnlocked && !startUltra; // esta partida desbloqueó el modo Ultra

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
    scratch: {} as Scratch,
    sumA: ZERO,
    sumM: 0,
    n: 0,
    base: { a: { x: 0, y: 0, z: 1 } as V3, m: 50 },
  }).current;

  useEffect(() => {
    preloadSounds(soundId);
    const goTo = (p: Phase) => {
      g.phase = p;
      setPhase(p);
    };

    const startRound = () => {
      const next = pickChallenge(pool, g.lastId);
      const ms = roundMs(g.score, next.id, mode);
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
          playSound(soundId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          goTo('between');
        }
      }
    };

    const id = setInterval(tick, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respuestas a lo que hace el jugador: el marcador y la cuenta regresiva "rebotan" al cambiar.
  useEffect(() => {
    if (score > 0) {
      pop.setValue(1.5);
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
  }, [score, pop]);
  useEffect(() => {
    countPop.setValue(1.35);
    Animated.spring(countPop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [count, countPop]);

  const onColor = phase === 'playing' || phase === 'between';
  const bg = phase === 'playing' && challenge ? challenge.color : phase === 'between' ? C.mint : C.ink;
  const fg = onColor ? C.ink : C.paper;
  const newRecord = score > startBest;

  return (
    <View style={[st.fill, { backgroundColor: bg, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }]}>
      <StatusBar style={onColor ? 'dark' : 'light'} />

      <View style={s.hud}>
        <View style={s.hudSide}>
          <Pressable onPress={onExit} hitSlop={12} style={[s.exit, { backgroundColor: onColor ? INK_SOFT_ON_COLOR : C.inkSoft }]}>
            <Text style={[s.exitText, { color: fg }]}>Salir</Text>
          </Pressable>
        </View>
        <Animated.Text style={[s.score, { color: fg, transform: [{ scale: pop }] }]}>{score}</Animated.Text>
        <View style={[s.hudSide, { alignItems: 'flex-end' }]}>
          <Text style={[s.best, { color: fg }]}>🏆 {Math.max(startBest, score)}</Text>
        </View>
      </View>

      <View style={[s.track, { opacity: phase === 'playing' ? 1 : 0 }]}>
        <Animated.View style={[s.fillBar, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>

      <View style={s.center}>
        {phase === 'ready' && (
          <>
            {mode !== 'normal' && <Text style={[s.modeTag, { color: mode === 'ultra' ? C.pink : C.yellow }]}>{mode === 'ultra' ? '🔥 ' : ''}Modo {MODES[mode].name}</Text>}
            <Text style={[s.hint, { color: C.muted }]}>Sostén el teléfono como vas a jugar</Text>
            <Animated.Text style={[s.count, { transform: [{ scale: countPop }] }]}>{count}</Animated.Text>
          </>
        )}

        {phase === 'playing' && challenge && (
          <>
            <View style={s.iconWrap}>
              <Text style={s.icon}>{challenge.icon}</Text>
            </View>
            <Text style={s.verb} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {challenge.verb}
            </Text>
            {MODES[mode].hints && <Text style={[s.hint, { color: C.ink, opacity: 0.8 }]}>{challenge.hint}</Text>}
          </>
        )}

        {phase === 'between' && (
          <>
            <Text style={s.icon}>✓</Text>
            <Text style={s.verb}>¡Bien!</Text>
          </>
        )}

        {phase === 'over' && (
          <>
            <Text style={[s.hint, { color: C.muted }]}>Se acabó el tiempo</Text>
            <Text style={s.finalScore}>{score}</Text>
            <Text style={[s.hint, { color: C.paper }]}>{score === 1 ? 'reto superado' : 'retos superados'}</Text>
            {newRecord ? (
              <Text style={s.badge}>🏆 ¡Nuevo récord!</Text>
            ) : (
              <Text style={[s.hint, { color: C.muted }]}>Tu récord es {startBest}</Text>
            )}
            {justUnlocked && (
              <>
                <Text style={s.unlock}>🔥 ¡Modo Ultra desbloqueado!</Text>
                <Text style={[s.hint, { color: C.muted }]}>Actívalo en el inicio, en Dificultad.</Text>
              </>
            )}
          </>
        )}
      </View>

      {phase === 'playing' && challenge && (
        <View style={s.chipRow}>
          <Text style={s.chip}>{challenge.sensorLabel}</Text>
        </View>
      )}

      {phase === 'over' && (
        <View style={{ gap: 14 }}>
          <Btn label="Jugar otra vez" color={C.yellow} onPress={onRestart} />
          <Btn label="Inicio" color={C.inkSoft} textColor={C.paper} small onPress={onExit} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hud: { flexDirection: 'row', alignItems: 'center' },
  hudSide: { flex: 1 },
  exit: { alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  exitText: { fontSize: 15, fontWeight: '800' },
  score: { fontSize: 46, fontWeight: '900', letterSpacing: -1.5, minWidth: 70, textAlign: 'center' },
  best: { fontSize: 16, fontWeight: '800' },
  track: { height: 16, borderRadius: 8, backgroundColor: INK_SOFT_ON_COLOR, overflow: 'hidden', marginTop: 12 },
  fillBar: { height: '100%', borderRadius: 8, backgroundColor: C.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  iconWrap: { width: 132, height: 132, borderRadius: 66, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 70, color: C.ink },
  verb: { color: C.ink, fontSize: 56, fontWeight: '900', letterSpacing: -2, textAlign: 'center', alignSelf: 'stretch' },
  hint: { fontSize: 18, lineHeight: 25, textAlign: 'center', fontWeight: '600' },
  count: { color: C.paper, fontSize: 150, fontWeight: '900', letterSpacing: -4 },
  finalScore: { color: C.yellow, fontSize: 120, fontWeight: '900', letterSpacing: -4, lineHeight: 130 },
  badge: { color: C.ink, backgroundColor: C.yellow, fontSize: 17, fontWeight: '900', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, overflow: 'hidden', marginTop: 6 },
  modeTag: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  unlock: { color: C.ink, backgroundColor: C.pink, fontSize: 17, fontWeight: '900', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, overflow: 'hidden', marginTop: 6 },
  chipRow: { alignItems: 'center' },
  chip: { color: C.paper, backgroundColor: C.ink, fontSize: 14, fontWeight: '800', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, overflow: 'hidden' },
});
