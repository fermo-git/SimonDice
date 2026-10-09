import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C } from './config';

/** Fondo más profundo: sombra del disco y borde inferior de las tarjetas. */
export const DEEP = '#0E0726';

/** Borde inferior de cada color: da el relieve de botón físico (como las teclas del Simón de juguete). */
export const EDGE: Record<string, string> = {
  [C.pink]: '#B83565',
  [C.yellow]: '#BF9206',
  [C.sky]: '#2677B5',
  [C.mint]: '#139A74',
  [C.violet]: '#6E48C4',
  [C.orange]: '#C46A1C',
  [C.paper]: '#B7ADDC',
  [C.inkSoft]: DEEP,
};

/** Botón con relieve: se hunde al tocarlo. */
export function Btn(props: { label: string; onPress: () => void; color?: string; textColor?: string; small?: boolean; disabled?: boolean; flex?: boolean }) {
  const { label, onPress, color = C.yellow, textColor = C.ink, small, disabled, flex } = props;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[flex && { flex: 1 }, disabled && { opacity: 0.4 }]}>
      {({ pressed }) => (
        <View style={{ backgroundColor: EDGE[color] ?? DEEP, borderRadius: 20, paddingBottom: pressed ? 2 : 6, marginTop: pressed ? 4 : 0 }}>
          <View style={{ backgroundColor: color, borderRadius: 20, paddingVertical: small ? 12 : 17, paddingHorizontal: 18, alignItems: 'center' }}>
            <Text style={{ color: textColor, fontSize: small ? 16 : 20, fontWeight: '900', letterSpacing: -0.3 }}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Tarjeta con borde inferior grueso, del mismo lenguaje que los botones. */
export function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <View style={{ backgroundColor: DEEP, borderRadius: 26, paddingBottom: 6 }}>
      <View style={[st.card, accent ? { borderLeftWidth: 6, borderLeftColor: accent } : null]}>{children}</View>
    </View>
  );
}

export function BackLink({ onPress, label = 'Volver' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={14} style={st.back}>
      <Text style={st.backText}>‹ {label}</Text>
    </Pressable>
  );
}

/** Disco de cuatro botones iluminados de uno en uno, con el botón de jugar en el centro. */
export function Disc({ size, onPlay, disabled }: { size: number; onPlay: () => void; disabled?: boolean }) {
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLit((n) => (n + 1) % 4), 850);
    return () => clearInterval(id);
  }, []);

  const half = size / 2;
  const pads = [
    { color: C.pink, left: 0, top: 0 },
    { color: C.yellow, left: half, top: 0 },
    { color: C.mint, left: half, top: half },
    { color: C.sky, left: 0, top: half },
  ];
  const core = size * 0.4;

  return (
    <View style={{ width: size, height: size + 12 }}>
      <View style={{ position: 'absolute', top: 12, width: size, height: size, borderRadius: half, backgroundColor: DEEP }} />
      <View style={{ width: size, height: size, borderRadius: half, overflow: 'hidden', backgroundColor: C.ink }}>
        {pads.map((p, i) => (
          <View key={p.color} style={{ position: 'absolute', left: p.left, top: p.top, width: half, height: half, backgroundColor: p.color, opacity: lit === i ? 1 : 0.34 }} />
        ))}
        <View style={{ position: 'absolute', left: 0, top: half - 6, width: size, height: 12, backgroundColor: C.ink }} />
        <View style={{ position: 'absolute', top: 0, left: half - 6, width: 12, height: size, backgroundColor: C.ink }} />
      </View>
      <Pressable
        onPress={onPlay}
        disabled={disabled}
        style={({ pressed }) => ({
          position: 'absolute',
          left: (size - core) / 2,
          top: (size - core) / 2,
          width: core,
          height: core,
          borderRadius: core / 2,
          backgroundColor: C.ink,
          borderWidth: 5,
          borderColor: C.paper,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.93 : 1 }],
        })}>
        <Text style={{ color: C.paper, fontSize: core * 0.26, fontWeight: '900', letterSpacing: -0.5 }}>Jugar</Text>
      </Pressable>
    </View>
  );
}

export const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.ink },
  title: { color: C.paper, fontSize: 42, fontWeight: '900', letterSpacing: -1.5 },
  lead: { color: C.muted, fontSize: 16, lineHeight: 22 },
  card: { backgroundColor: C.inkSoft, borderRadius: 26, padding: 18, gap: 12 },
  cardTitle: { color: C.paper, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  cardText: { color: C.muted, fontSize: 15, lineHeight: 21 },
  fine: { color: C.muted, fontSize: 13, lineHeight: 18 },
  notice: { color: C.yellow, fontSize: 15, lineHeight: 21 },
  back: { alignSelf: 'flex-start' },
  backText: { color: C.sky, fontSize: 17, fontWeight: '800' },
});
