import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '../config';
import { MODES, ULTRA_UNLOCK_SCORE, type Mode } from '../game';
import { planNameChange } from '../profile';
import type { SensorKey } from '../sensors';
import type { Saved } from '../services';
import { Btn, Disc, st } from '../ui';

const MODE_COLORS: Record<Mode, string> = { normal: C.mint, hard: C.yellow, ultra: C.pink };
const SENSOR_NAMES: Record<SensorKey, string> = { acc: 'Acelerómetro', gyro: 'Giroscopio', mag: 'Magnetómetro' };

export function Home(props: {
  saved: Saved;
  update: (patch: Partial<Saved>) => void;
  available: Record<SensorKey, boolean>;
  mode: Mode; // dificultad efectiva (Ultra solo si está desbloqueada)
  canPlay: boolean;
  onPlay: () => void;
  onRanking: () => void;
  onShop: () => void;
}) {
  const { saved, update, available, mode, canPlay, onPlay, onRanking, onShop } = props;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const disc = Math.max(200, Math.min(width - 72, 330, height * 0.4));
  const [nick, setNick] = useState(saved.name);

  /** Al terminar de escribir el apodo. Un nombre nuevo reinicia el récord (con confirmación si había uno). */
  const commitName = (raw: string) => {
    const plan = planNameChange(saved, raw);
    if (plan.action === 'ignore') {
      setNick(saved.name); // vacío o igual: se deja como estaba
      return;
    }
    const apply = () => {
      setNick(plan.patch.name);
      update(plan.patch);
    };
    if (!plan.needsConfirm) {
      apply();
      return;
    }
    const previous = saved.name.trim() || 'Jugador';
    Alert.alert(
      '¿Cambiar de jugador?',
      `Con el apodo «${plan.patch.name}» empiezas un jugador nuevo, desde cero.` +
        (saved.best > 0 ? ` «${previous}» (${saved.best}) se queda en el ranking con su récord.` : ''),
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => setNick(saved.name) },
        { text: 'Cambiar', style: 'destructive', onPress: apply },
      ],
      { cancelable: true, onDismiss: () => setNick(saved.name) },
    );
  };

  return (
    <ScrollView
      style={st.fill}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20, gap: 18 }}
      keyboardShouldPersistTaps="handled">
      <View style={s.top}>
        <TextInput
          style={s.nick}
          value={nick}
          onChangeText={setNick}
          placeholder="Tu apodo"
          placeholderTextColor={C.muted}
          maxLength={16}
          autoCorrect={false}
          returnKeyType="done"
          onEndEditing={(e) => commitName(e.nativeEvent.text)}
        />
        <View style={s.record}>
          <Text style={s.recordIcon}>🏆</Text>
          <Text style={s.recordText}>{saved.best}</Text>
        </View>
      </View>

      <View>
        <Text style={st.title}>Simón dice</Text>
        <Text style={st.lead}>Obedece al teléfono antes de que se acabe el tiempo.</Text>
      </View>

      <View style={s.hero}>
        <Disc size={disc} onPlay={onPlay} disabled={!canPlay} />
        <View style={s.sensors}>
          {(Object.keys(SENSOR_NAMES) as SensorKey[]).map((k) => (
            <View key={k} style={s.sensor}>
              <View style={[s.dot, { backgroundColor: available[k] ? C.mint : C.pink }]} />
              <Text style={[s.sensorText, !available[k] && { color: C.pink }]}>{SENSOR_NAMES[k]}</Text>
            </View>
          ))}
        </View>
        {saved.last !== null && <Text style={st.fine}>Última partida: {saved.last} {saved.last === 1 ? 'reto' : 'retos'}</Text>}
      </View>

      <View style={s.mode}>
        <Text style={s.modeTitle}>Dificultad</Text>
        <View style={s.segments}>
          {(['normal', 'hard', 'ultra'] as Mode[]).map((m) => {
            const locked = m === 'ultra' && !saved.ultraUnlocked;
            const selected = mode === m;
            return (
              <Pressable
                key={m}
                style={[s.segment, selected && { backgroundColor: MODE_COLORS[m] }]}
                onPress={() =>
                  locked
                    ? Alert.alert('Modo Ultra bloqueado', `Consigue al menos ${ULTRA_UNLOCK_SCORE} retos en una partida de modo Difícil para desbloquearlo.`)
                    : update({ mode: m })
                }>
                <Text style={[s.segmentText, selected && { color: C.ink }, locked && { color: C.muted }]}>
                  {locked ? '🔒 ' : m === 'ultra' ? '🔥 ' : ''}
                  {MODES[m].name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={st.fine}>
          {MODES[mode].blurb}
          {!saved.ultraUnlocked ? ` Ultra se desbloquea con ${ULTRA_UNLOCK_SCORE} retos en Difícil.` : ''}
        </Text>
      </View>

      <View style={s.bottom}>
        <Btn flex label="Ranking" color={C.sky} onPress={onRanking} />
        <Btn flex label="Tienda" color={C.violet} textColor={C.paper} onPress={onShop} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nick: { flex: 1, backgroundColor: C.inkSoft, color: C.paper, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 11, fontSize: 16, fontWeight: '700' },
  record: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.inkSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  recordIcon: { fontSize: 18 },
  recordText: { color: C.yellow, fontSize: 20, fontWeight: '900' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 280 },
  sensors: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  sensor: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sensorText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  mode: { gap: 10, backgroundColor: C.inkSoft, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 },
  modeTitle: { color: C.paper, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  segments: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, alignItems: 'center', backgroundColor: C.ink, borderRadius: 14, paddingVertical: 10 },
  segmentText: { color: C.paper, fontSize: 15, fontWeight: '900' },
  bottom: { flexDirection: 'row', gap: 14 },
});
