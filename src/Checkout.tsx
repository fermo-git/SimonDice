import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from './config';

/**
 * Pago dentro de la app: abre el Payment Link en un WebView y detecta que Stripe terminó el cobro.
 *
 * En cada Payment Link de Stripe: "Después del pago" → "No mostrar página de confirmación"
 * → redirigir a SUCCESS_URL. Esa página nunca llega a cargarse: la app intercepta la redirección,
 * cierra el WebView y desbloquea la compra, sin preguntarle nada al jugador.
 *
 * Si `react-native-webview` no está en el build instalado, avisa con `onUnavailable` y la app usa
 * el navegador con la pregunta "¿Completaste el pago?" como respaldo.
 */
export const SUCCESS_URL = 'https://example.com/pago-ok';

type WebViewModule = typeof import('react-native-webview');

function loadWebView(): WebViewModule['WebView'] | null {
  try {
    return (require('react-native-webview') as WebViewModule).WebView;
  } catch {
    return null;
  }
}

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Checkout(props: { link: string; onDone: (paid: boolean) => void; onUnavailable: () => void }) {
  const { link, onDone, onUnavailable } = props;
  const insets = useSafeAreaInsets();
  const WebView = useMemo(loadWebView, []);
  const finished = useRef(false);

  const finish = (paid: boolean) => {
    if (!finished.current) {
      finished.current = true;
      onDone(paid);
    }
  };
  const unavailable = () => {
    if (!finished.current) {
      finished.current = true;
      onUnavailable();
    }
  };

  useEffect(() => {
    if (!WebView) {
      unavailable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!WebView) {
    return null;
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => finish(false)}>
      <View style={[st.fill, { paddingTop: insets.top }]}>
        <View style={st.bar}>
          <Pressable onPress={() => finish(false)} hitSlop={12}>
            <Text style={st.close}>Cerrar</Text>
          </Pressable>
          <Text style={st.title}>Pago de prueba</Text>
        </View>
        <Boundary onError={unavailable}>
          <WebView
            source={{ uri: link }}
            startInLoadingState
            renderLoading={() => <ActivityIndicator style={st.loading} color={C.yellow} size="large" />}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith(SUCCESS_URL)) {
                finish(true);
                return false;
              }
              return true;
            }}
            onNavigationStateChange={(nav) => {
              if (nav.url.startsWith(SUCCESS_URL)) {
                finish(true);
              }
            }}
          />
        </Boundary>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.ink },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  close: { color: C.yellow, fontSize: 16, fontWeight: '700' },
  title: { color: C.muted, fontSize: 14 },
  loading: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
});
