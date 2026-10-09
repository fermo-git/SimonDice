import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '../config';
import { PACK_PRICE_LABEL, SOUNDS_PRICE_LABEL } from '../products';
import type { Saved } from '../services';
import { playSound, SOUNDS, type SoundId } from '../sound';
import { BackLink, Btn, Card, st } from '../ui';

function Badge({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color }]}>
      <Text style={s.badgeIcon}>{icon}</Text>
    </View>
  );
}

export function Shop(props: {
  saved: Saved;
  update: (patch: Partial<Saved>) => void;
  soundId: SoundId; // sonido que realmente suena (ding si no compró el pack)
  onBuyPack: () => void;
  onBuySounds: () => void;
  onBack: () => void;
}) {
  const { saved, update, soundId, onBuyPack, onBuySounds, onBack } = props;
  const insets = useSafeAreaInsets();

  /** Toca un sonido: siempre lo reproduce (vista previa); solo lo elige si está disponible. */
  const pick = (id: SoundId, premium: boolean) => {
    playSound(id);
    if (!premium || saved.sounds) {
      update({ sound: id });
    }
  };

  return (
    <ScrollView style={st.fill} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 18 }}>
      <BackLink onPress={onBack} />
      <View>
        <Text style={st.title}>Tienda</Text>
        <Text style={st.lead}>Compras de prueba con Stripe: no se cobra dinero real.</Text>
      </View>

      <Card accent={C.sky}>
        <View style={s.head}>
          <Badge icon="🧩" color={C.sky} />
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Pack de retos extra</Text>
            <Text style={st.cardText}>Cuatro retos nuevos: ¡Adelante!, ¡Atrás!, ¡Doble agitada! y ¡Volante!</Text>
          </View>
        </View>
        {saved.pack ? (
          <View style={s.owned}>
            <Text style={s.ownedText}>Comprado ✓  Ya salen en tus partidas</Text>
          </View>
        ) : (
          <Btn label={`Desbloquear por ${PACK_PRICE_LABEL}`} color={C.sky} onPress={onBuyPack} small />
        )}
      </Card>

      <Card accent={C.pink}>
        <View style={s.head}>
          <Badge icon="🔊" color={C.pink} />
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Pack de sonidos</Text>
            <Text style={st.cardText}>Tres sonidos nuevos para cuando aciertas un reto: moneda, campana y burbuja.</Text>
          </View>
        </View>

        <View style={s.chips}>
          {SOUNDS.map((snd) => {
            const locked = snd.premium && !saved.sounds;
            const selected = soundId === snd.id;
            return (
              <Pressable key={snd.id} onPress={() => pick(snd.id, snd.premium)} style={[s.chip, selected && s.chipOn]}>
                <Text style={s.chipIcon}>{locked ? '🔒' : snd.icon}</Text>
                <Text style={[s.chipText, selected && { color: C.ink }]}>{snd.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {saved.sounds ? (
          <View style={s.owned}>
            <Text style={s.ownedText}>Comprado ✓  Toca uno para elegirlo</Text>
          </View>
        ) : (
          <>
            <Text style={st.fine}>Toca los candados para escuchar una vista previa.</Text>
            <Btn label={`Desbloquear por ${SOUNDS_PRICE_LABEL}`} color={C.pink} onPress={onBuySounds} small />
          </>
        )}
      </Card>

      <Text style={st.fine}>Tarjeta de prueba: 4242 4242 4242 4242, cualquier fecha futura y CVC 123.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  badgeIcon: { fontSize: 26 },
  owned: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.ink, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  ownedText: { color: C.mint, fontSize: 15, fontWeight: '800', flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  chipOn: { backgroundColor: C.yellow },
  chipIcon: { fontSize: 16 },
  chipText: { color: C.paper, fontSize: 15, fontWeight: '800' },
});
