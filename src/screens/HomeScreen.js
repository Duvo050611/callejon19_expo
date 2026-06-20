import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

const BG    = '#080808';
const CARD  = '#111111';
const RED   = '#e63946';
const BLUE  = '#22d3ee';
const BORDER = '#1a1a1a';

export default function HomeScreen({ onHangman, onHydration }) {
  const { width } = useWindowDimensions();
  const W = Math.min(width - 32, 420);

  return (
    <View style={s.root}>
      <View style={{ width: W }}>
        <Text style={s.appName}>MI PROYECTO</Text>
        <Text style={s.subtitle}>Selecciona una aplicación</Text>
        <View style={s.divider} />

        <View style={s.list}>
          <TouchableOpacity style={[s.card, { borderLeftColor: RED }]} onPress={onHangman}>
            <Text style={s.cardIcon}>💀</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: RED }]}>EL AHORCADO</Text>
              <Text style={s.cardDesc}>1 jugador · 2 jugadores local · 2 jugadores online</Text>
            </View>
            <Text style={[s.chev, { color: RED }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.card, { borderLeftColor: BLUE }]} onPress={onHydration}>
            <Text style={s.cardIcon}>💧</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: BLUE }]}>HIDRATACIÓN</Text>
              <Text style={s.cardDesc}>Monitor de agua para wearable · 6 secciones</Text>
            </View>
            <Text style={[s.chev, { color: BLUE }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 16 },
  appName:  { color: '#1a1a1a', fontSize: 11, fontWeight: '900', letterSpacing: 8, marginBottom: 6 },
  subtitle: { color: '#f0f0f0', fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  divider:  { width: 48, height: 3, backgroundColor: '#1e1e1e', marginTop: 12, marginBottom: 32 },
  list:     { gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CARD, borderRadius: 14, padding: 20,
    borderLeftWidth: 3,
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderTopColor: BORDER, borderRightColor: BORDER, borderBottomColor: BORDER,
  },
  cardIcon:  { fontSize: 30 },
  cardTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 3, marginBottom: 4 },
  cardDesc:  { color: '#363636', fontSize: 11 },
  chev:      { fontSize: 24, fontWeight: '300' },
});
