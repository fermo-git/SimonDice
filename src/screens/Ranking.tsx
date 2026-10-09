import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cloudConfigured, watchLeaderboard, type RankRow } from '../cloud';
import { C } from '../config';
import { BackLink, st } from '../ui';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Ranking({ myName, onBack }: { myName: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(
    () =>
      watchLeaderboard(
        (data, uid) => {
          setRows(data);
          setMyUid(uid);
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [],
  );

  return (
    <ScrollView style={st.fill} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
      <BackLink onPress={onBack} />
      <View style={{ marginBottom: 6 }}>
        <Text style={st.title}>Ranking</Text>
        <Text style={st.lead}>Los 10 mejores jugadores, en vivo desde la nube.</Text>
      </View>

      {!cloudConfigured && <Text style={st.notice}>Falta configurar Firebase en src/firebaseConfig.ts.</Text>}
      {cloudConfigured && failed && <Text style={st.notice}>No se pudo cargar el ranking. Revisa tu conexión a internet.</Text>}
      {cloudConfigured && !failed && rows === null && <Text style={st.lead}>Cargando…</Text>}
      {rows?.length === 0 && <Text style={st.lead}>Aún no hay puntajes. Juega una partida y sé el primero.</Text>}

      {rows?.map((r, i) => {
        const mine = r.id === myUid;
        return (
          <View key={r.id} style={[s.row, mine && s.mine]}>
            <Text style={s.pos}>{MEDALS[i] ?? i + 1}</Text>
            <Text style={[s.name, mine && { color: C.ink }]} numberOfLines={1}>
              {r.name}
              {mine ? ' (tú)' : ''}
            </Text>
            <Text style={[s.score, mine && { color: C.ink }]}>{r.best}</Text>
          </View>
        );
      })}
      {myName === '' && rows && rows.length > 0 && <Text style={st.fine}>Escribe tu apodo en el inicio para aparecer con tu nombre.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.inkSoft, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 },
  mine: { backgroundColor: C.yellow },
  pos: { width: 34, textAlign: 'center', color: C.muted, fontSize: 20, fontWeight: '900' },
  name: { flex: 1, color: C.paper, fontSize: 17, fontWeight: '700' },
  score: { color: C.yellow, fontSize: 22, fontWeight: '900' },
});
