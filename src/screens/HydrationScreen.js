import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const BG    = '#080808';
const CARD  = '#0a1a24';
const BLUE  = '#22d3ee';
const DBLUE = '#0ea5e9';
const DIM   = '#0f2a38';
const TEXT  = '#e0f2fe';
const MUTED = '#2a5060';
const RED   = '#f87171';
const GREEN = '#4ade80';
const AMBER = '#fbbf24';

const DEFAULT_GOAL = 2000;
const TABS = [
  { icon: '🏠', label: 'Inicio'     },
  { icon: '💧', label: 'Registrar'  },
  { icon: '🎯', label: 'Meta'       },
  { icon: '📋', label: 'Historial'  },
  { icon: '📊', label: 'Gráfica'    },
  { icon: '⏰', label: 'Alerta'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatElapsed(secs) {
  if (secs < 60)  return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function last7Keys() {
  const keys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return keys;
}

// ─── Círculo de progreso (SVG) ────────────────────────────────────────────────
function CircleProgress({ current, goal, size }) {
  const r    = (size - 24) / 2;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(current / goal, 1);
  const fill = pct >= 1 ? GREEN : pct >= 0.6 ? BLUE : pct >= 0.3 ? DBLUE : MUTED;

  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${cx},${cy}`}>
        <Circle cx={cx} cy={cy} r={r} stroke={DIM} strokeWidth={12} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={fill} strokeWidth={12} fill="none"
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

// ─── Barra de gráfica ─────────────────────────────────────────────────────────
function Bar({ value, goal, label, maxH }) {
  const pct    = Math.min(value / goal, 1);
  const height = Math.max(4, Math.round(pct * maxH));
  const color  = pct >= 1 ? GREEN : pct >= 0.5 ? BLUE : MUTED;
  const day    = label.slice(8); // DD
  return (
    <View style={bar.wrap}>
      <Text style={bar.val}>{value > 0 ? `${value}` : ''}</Text>
      <View style={[bar.col, { height: maxH, justifyContent: 'flex-end' }]}>
        <View style={[bar.fill, { height, backgroundColor: color }]} />
      </View>
      <Text style={bar.label}>{day}</Text>
    </View>
  );
}
const bar = StyleSheet.create({
  wrap:  { alignItems: 'center', gap: 4 },
  val:   { color: MUTED, fontSize: 8, fontWeight: '700' },
  col:   { width: 22, backgroundColor: DIM, borderRadius: 4 },
  fill:  { width: '100%', borderRadius: 4 },
  label: { color: MUTED, fontSize: 9, fontWeight: '700' },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function HydrationScreen({ onBack }) {
  const { width, height } = useWindowDimensions();
  const isWeb  = Platform.OS === 'web';
  // Tamaño del "wearable": cuadrado compacto centrado
  const wSize  = Math.min(width, height, isWeb ? 300 : Math.min(width, 320));

  const [tab,      setTab]      = useState(0);
  const [log,      setLog]      = useState([]);   // [{id, ts, ml}] de hoy
  const [goal,     setGoal]     = useState(DEFAULT_GOAL);
  const [history,  setHistory]  = useState({});   // { dateKey: totalMl }
  const [lastDrink, setLastDrink] = useState(null);
  const [elapsed,  setElapsed]  = useState(0);
  const [loaded,   setLoaded]   = useState(false);
  const [error,    setError]    = useState(null);
  const timerRef = useRef(null);

  // ── Carga desde AsyncStorage ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [rawGoal, rawLog, rawHist, rawLast] = await Promise.all([
          AsyncStorage.getItem('hyd_goal'),
          AsyncStorage.getItem(`hyd_log_${todayKey()}`),
          AsyncStorage.getItem('hyd_history'),
          AsyncStorage.getItem('hyd_lastDrink'),
        ]);
        if (rawGoal)  setGoal(parseInt(rawGoal, 10));
        if (rawLog)   setLog(JSON.parse(rawLog));
        if (rawHist)  setHistory(JSON.parse(rawHist));
        if (rawLast)  setLastDrink(parseInt(rawLast, 10));
      } catch (e) {
        setError('Error al cargar datos: ' + e.message);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Guarda en AsyncStorage ────────────────────────────────────────────────
  const save = useCallback(async (newLog, newGoal, newHistory, newLast) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(`hyd_log_${todayKey()}`, JSON.stringify(newLog)),
        AsyncStorage.setItem('hyd_goal', String(newGoal)),
        AsyncStorage.setItem('hyd_history', JSON.stringify(newHistory)),
        newLast != null
          ? AsyncStorage.setItem('hyd_lastDrink', String(newLast))
          : AsyncStorage.removeItem('hyd_lastDrink'),
      ]);
      setError(null);
    } catch (e) {
      setError('Error al guardar: ' + e.message);
    }
  }, []);

  // ── Timer de alerta ───────────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (lastDrink == null) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - lastDrink) / 1000));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [lastDrink]);

  // ── Registrar vaso ────────────────────────────────────────────────────────
  function addWater(ml) {
    const entry    = { id: Date.now(), ts: Date.now(), ml };
    const newLog   = [entry, ...log];
    const key      = todayKey();
    const total    = newLog.reduce((s, e) => s + e.ml, 0);
    const newHist  = { ...history, [key]: total };
    setLog(newLog);
    setHistory(newHist);
    setLastDrink(entry.ts);
    save(newLog, goal, newHist, entry.ts);
  }

  // ── Cambiar meta ──────────────────────────────────────────────────────────
  function changeGoal(delta) {
    const next = Math.max(500, Math.min(5000, goal + delta));
    setGoal(next);
    save(log, next, history, lastDrink);
  }

  // ── Borrar historial de hoy ───────────────────────────────────────────────
  function clearToday() {
    const key     = todayKey();
    const newHist = { ...history, [key]: 0 };
    setLog([]);
    setHistory(newHist);
    setLastDrink(null);
    save([], goal, newHist, null);
  }

  if (!loaded) {
    return (
      <View style={s.root}>
        <Text style={s.loading}>Cargando…</Text>
      </View>
    );
  }

  const today    = log.reduce((sum, e) => sum + e.ml, 0);
  const pct      = Math.min(today / goal, 1);
  const alertMin = lastDrink ? Math.floor(elapsed / 60) : null;
  const alertOn  = alertMin != null && alertMin >= 60;
  const keys7    = last7Keys();

  // ── Contenido de cada tab ─────────────────────────────────────────────────
  const renderTab = () => {
    switch (tab) {

      // ── 0: Dashboard ───────────────────────────────────────────────────────
      case 0: return (
        <View style={s.tabContent}>
          <View style={{ alignItems: 'center' }}>
            <View style={s.circleWrap}>
              <CircleProgress current={today} goal={goal} size={wSize * 0.62} />
              <View style={s.circleCenter}>
                <Text style={s.circleMain}>{today}</Text>
                <Text style={s.circleSub}>ml</Text>
                <Text style={[s.circlePct, { color: pct >= 1 ? GREEN : BLUE }]}>
                  {Math.round(pct * 100)}%
                </Text>
              </View>
            </View>
            <Text style={s.goalLabel}>Meta: {goal} ml</Text>
            {pct >= 1 && <Text style={s.badge}>¡Meta alcanzada! 🎉</Text>}
          </View>

          <TouchableOpacity style={s.mainBtn} onPress={() => addWater(250)}>
            <Text style={s.mainBtnIcon}>💧</Text>
            <Text style={s.mainBtnText}>+250 ml</Text>
          </TouchableOpacity>
        </View>
      );

      // ── 1: Registrar ───────────────────────────────────────────────────────
      case 1: return (
        <View style={s.tabContent}>
          <Text style={s.sectionTitle}>REGISTRAR</Text>
          <Text style={s.sectionSub}>Selecciona la cantidad de agua</Text>
          <View style={s.grid2}>
            {[150, 250, 350, 500].map((ml) => (
              <TouchableOpacity key={ml} style={s.mlBtn} onPress={() => addWater(ml)}>
                <Text style={s.mlBtnIcon}>💧</Text>
                <Text style={s.mlBtnMl}>{ml}</Text>
                <Text style={s.mlBtnUnit}>ml</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.statusRow}>
            <View style={s.statusItem}>
              <Text style={s.statusVal}>{today}</Text>
              <Text style={s.statusLbl}>ml hoy</Text>
            </View>
            <View style={s.statusItem}>
              <Text style={s.statusVal}>{log.length}</Text>
              <Text style={s.statusLbl}>registros</Text>
            </View>
            <View style={s.statusItem}>
              <Text style={[s.statusVal, { color: goal - today > 0 ? AMBER : GREEN }]}>
                {Math.max(0, goal - today)}
              </Text>
              <Text style={s.statusLbl}>ml faltan</Text>
            </View>
          </View>
        </View>
      );

      // ── 2: Meta ────────────────────────────────────────────────────────────
      case 2: return (
        <View style={s.tabContent}>
          <Text style={s.sectionTitle}>META DIARIA</Text>
          <Text style={s.sectionSub}>Ajusta tu objetivo de hidratación</Text>
          <View style={s.goalCard}>
            <TouchableOpacity style={s.goalBtn} onPress={() => changeGoal(-250)}>
              <Text style={s.goalBtnText}>−</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.goalBig}>{goal}</Text>
              <Text style={s.goalUnit}>ml / día</Text>
            </View>
            <TouchableOpacity style={s.goalBtn} onPress={() => changeGoal(+250)}>
              <Text style={s.goalBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={s.referenceList}>
            {[
              { label: 'Mínimo', val: 1500 },
              { label: 'Recomendado', val: 2000 },
              { label: 'Activo', val: 3000 },
            ].map((r) => (
              <TouchableOpacity
                key={r.val}
                style={[s.refBtn, goal === r.val && s.refBtnActive]}
                onPress={() => { setGoal(r.val); save(log, r.val, history, lastDrink); }}
              >
                <Text style={[s.refLabel, goal === r.val && { color: BLUE }]}>{r.label}</Text>
                <Text style={[s.refVal,   goal === r.val && { color: BLUE }]}>{r.val} ml</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );

      // ── 3: Historial ───────────────────────────────────────────────────────
      case 3: return (
        <View style={s.tabContent}>
          <View style={s.histHeader}>
            <Text style={s.sectionTitle}>HISTORIAL HOY</Text>
            <TouchableOpacity onPress={clearToday}>
              <Text style={s.clearBtn}>Borrar</Text>
            </TouchableOpacity>
          </View>
          {log.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🫙</Text>
              <Text style={s.emptyText}>Sin registros hoy</Text>
            </View>
          ) : (
            <FlatList
              data={log}
              keyExtractor={(e) => String(e.id)}
              style={{ flex: 1, width: '100%' }}
              renderItem={({ item }) => (
                <View style={s.logRow}>
                  <Text style={s.logTime}>{formatTime(item.ts)}</Text>
                  <View style={s.logBar}>
                    <View style={[s.logFill, { width: `${Math.min((item.ml / 500) * 100, 100)}%` }]} />
                  </View>
                  <Text style={s.logMl}>+{item.ml} ml</Text>
                </View>
              )}
            />
          )}
        </View>
      );

      // ── 4: Gráfica ────────────────────────────────────────────────────────
      case 4: {
        const maxBar = Math.max(goal, ...keys7.map((k) => history[k] || 0));
        const barH   = 100;
        return (
          <View style={s.tabContent}>
            <Text style={s.sectionTitle}>ÚLTIMOS 7 DÍAS</Text>
            <View style={s.chartArea}>
              {keys7.map((k) => (
                <Bar
                  key={k}
                  value={history[k] || 0}
                  goal={goal}
                  label={k}
                  maxH={barH}
                />
              ))}
            </View>
            <View style={s.chartLegend}>
              <View style={[s.dot, { backgroundColor: GREEN }]} />
              <Text style={s.legendText}>Meta alcanzada</Text>
              <View style={[s.dot, { backgroundColor: BLUE }]} />
              <Text style={s.legendText}>En progreso</Text>
              <View style={[s.dot, { backgroundColor: MUTED }]} />
              <Text style={s.legendText}>Sin registros</Text>
            </View>
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statVal}>
                  {keys7.filter((k) => (history[k] || 0) >= goal).length}
                </Text>
                <Text style={s.statLbl}>metas{'\n'}alcanzadas</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statVal}>
                  {Math.round(keys7.reduce((s, k) => s + (history[k] || 0), 0) / 7)}
                </Text>
                <Text style={s.statLbl}>ml{'\n'}promedio</Text>
              </View>
            </View>
          </View>
        );
      }

      // ── 5: Alerta ─────────────────────────────────────────────────────────
      case 5: return (
        <View style={s.tabContent}>
          <Text style={s.sectionTitle}>RECORDATORIO</Text>
          <View style={[s.alertCard, { borderColor: alertOn ? RED : alertMin != null && alertMin >= 30 ? AMBER : BLUE }]}>
            <Text style={s.alertIcon}>
              {lastDrink == null ? '😴' : alertOn ? '🚨' : alertMin >= 30 ? '⚠️' : '✅'}
            </Text>
            {lastDrink == null ? (
              <Text style={s.alertMsg}>Sin registros hoy</Text>
            ) : (
              <>
                <Text style={[s.alertTime, { color: alertOn ? RED : alertMin >= 30 ? AMBER : GREEN }]}>
                  {formatElapsed(elapsed)}
                </Text>
                <Text style={s.alertSub}>desde el último vaso</Text>
                {alertOn && (
                  <Text style={[s.alertWarn, { color: RED }]}>¡Bebe agua ahora!</Text>
                )}
                {!alertOn && alertMin >= 30 && (
                  <Text style={[s.alertWarn, { color: AMBER }]}>Pronto toca hidratarse</Text>
                )}
              </>
            )}
          </View>
          <View style={s.alertInfo}>
            <View style={s.alertRow}>
              <View style={[s.dot, { backgroundColor: GREEN }]} />
              <Text style={s.alertInfoText}>0–29 min — Hidratado</Text>
            </View>
            <View style={s.alertRow}>
              <View style={[s.dot, { backgroundColor: AMBER }]} />
              <Text style={s.alertInfoText}>30–59 min — Bebe pronto</Text>
            </View>
            <View style={s.alertRow}>
              <View style={[s.dot, { backgroundColor: RED }]} />
              <Text style={s.alertInfoText}>60+ min — ¡Bebe ya!</Text>
            </View>
          </View>
          <TouchableOpacity style={s.mainBtn} onPress={() => { addWater(250); setTab(0); }}>
            <Text style={s.mainBtnIcon}>💧</Text>
            <Text style={s.mainBtnText}>Registrar ahora</Text>
          </TouchableOpacity>
        </View>
      );

      default: return null;
    }
  };

  return (
    <View style={s.root}>
      {/* Botón salir */}
      <TouchableOpacity style={s.exit} onPress={onBack}>
        <Text style={s.exitText}>← SALIR</Text>
      </TouchableOpacity>

      {/* Banner de error */}
      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Contenedor tipo wearable */}
      <View style={[s.watch, { width: wSize, minHeight: wSize }]}>
        {/* Cabecera */}
        <View style={s.watchHeader}>
          <Text style={s.watchIcon}>💧</Text>
          <Text style={s.watchTitle}>HIDRATACIÓN</Text>
          {alertOn && <Text style={s.alertDot}>●</Text>}
        </View>

        {/* Contenido del tab */}
        <View style={{ flex: 1, width: '100%' }}>
          {renderTab()}
        </View>

        {/* Barra de tabs */}
        <View style={s.tabBar}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={i} style={s.tabItem} onPress={() => setTab(i)}>
              <Text style={[s.tabIcon, tab === i && s.tabIconActive]}>{t.icon}</Text>
              <Text style={[s.tabLabel, tab === i && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  loading:     { color: TEXT, fontSize: 16 },

  exit:        { position: 'absolute', top: Platform.OS === 'ios' ? 52 : 28, left: 16 },
  exitText:    { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 3 },

  errorBanner: { backgroundColor: '#2d0a0a', borderRadius: 8, padding: 10, marginBottom: 8, maxWidth: 300 },
  errorText:   { color: RED, fontSize: 12, textAlign: 'center' },

  watch: {
    backgroundColor: CARD,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#0f2535',
    overflow: 'hidden',
    shadowColor: BLUE,
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },

  watchHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#0a1e2c',
  },
  watchIcon:  { fontSize: 16 },
  watchTitle: { flex: 1, color: BLUE, fontSize: 11, fontWeight: '900', letterSpacing: 4 },
  alertDot:   { color: RED, fontSize: 10 },

  tabContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },

  // Dashboard
  circleWrap:  { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  circleCenter:{ position: 'absolute', alignItems: 'center' },
  circleMain:  { color: TEXT, fontSize: 30, fontWeight: '900', lineHeight: 32 },
  circleSub:   { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  circlePct:   { fontSize: 13, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  goalLabel:   { color: MUTED, fontSize: 10, letterSpacing: 2 },
  badge:       { color: GREEN, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 2 },

  mainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0a2535', borderRadius: 14,
    borderWidth: 1, borderColor: BLUE,
    paddingVertical: 12, paddingHorizontal: 24, width: '100%',
  },
  mainBtnIcon: { fontSize: 18 },
  mainBtnText: { color: BLUE, fontSize: 14, fontWeight: '900', letterSpacing: 2 },

  // Registrar
  sectionTitle: { color: BLUE, fontSize: 10, fontWeight: '900', letterSpacing: 5 },
  sectionSub:   { color: MUTED, fontSize: 9, letterSpacing: 1, marginTop: -4 },

  grid2: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    justifyContent: 'center', width: '100%',
  },
  mlBtn: {
    width: '44%', backgroundColor: '#0a1e2c', borderRadius: 12,
    borderWidth: 1, borderColor: '#0f2a3a',
    alignItems: 'center', paddingVertical: 14, gap: 2,
  },
  mlBtnIcon: { fontSize: 20 },
  mlBtnMl:   { color: TEXT, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  mlBtnUnit: { color: MUTED, fontSize: 9, letterSpacing: 2 },

  statusRow:  { flexDirection: 'row', gap: 8, width: '100%' },
  statusItem: { flex: 1, backgroundColor: '#070f16', borderRadius: 10, alignItems: 'center', paddingVertical: 8 },
  statusVal:  { color: TEXT, fontSize: 16, fontWeight: '900' },
  statusLbl:  { color: MUTED, fontSize: 8, letterSpacing: 1, marginTop: 1 },

  // Meta
  goalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#070f16', borderRadius: 18,
    paddingVertical: 20, paddingHorizontal: 24, width: '100%',
  },
  goalBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0a2535', borderWidth: 1, borderColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
  },
  goalBtnText: { color: BLUE, fontSize: 22, fontWeight: '300', lineHeight: 24 },
  goalBig:     { color: TEXT, fontSize: 32, fontWeight: '900' },
  goalUnit:    { color: MUTED, fontSize: 10, letterSpacing: 2 },

  referenceList: { gap: 6, width: '100%' },
  refBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#070f16', borderRadius: 10,
    borderWidth: 1, borderColor: '#0a1e2c',
    paddingVertical: 10, paddingHorizontal: 14,
  },
  refBtnActive: { borderColor: BLUE },
  refLabel:     { color: MUTED, fontSize: 11, fontWeight: '700' },
  refVal:       { color: MUTED, fontSize: 11, fontWeight: '700' },

  // Historial
  histHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  clearBtn:    { color: RED, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon:   { fontSize: 36 },
  emptyText:   { color: MUTED, fontSize: 12, letterSpacing: 2 },

  logRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#0a1e2c' },
  logTime:  { color: MUTED, fontSize: 10, fontWeight: '700', width: 36 },
  logBar:   { flex: 1, height: 4, backgroundColor: DIM, borderRadius: 2, overflow: 'hidden' },
  logFill:  { height: '100%', backgroundColor: BLUE, borderRadius: 2 },
  logMl:    { color: TEXT, fontSize: 10, fontWeight: '800', width: 52, textAlign: 'right' },

  // Gráfica
  chartArea:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 4 },
  chartLegend: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  dot:         { width: 7, height: 7, borderRadius: 4 },
  legendText:  { color: MUTED, fontSize: 8 },
  statsRow:    { flexDirection: 'row', gap: 8, width: '100%' },
  statCard:    { flex: 1, backgroundColor: '#070f16', borderRadius: 12, alignItems: 'center', paddingVertical: 10 },
  statVal:     { color: TEXT, fontSize: 22, fontWeight: '900' },
  statLbl:     { color: MUTED, fontSize: 8, letterSpacing: 1, textAlign: 'center', marginTop: 2 },

  // Alerta
  alertCard: {
    alignItems: 'center', gap: 6,
    backgroundColor: '#070f16', borderRadius: 18,
    borderWidth: 2, paddingVertical: 20, paddingHorizontal: 16, width: '100%',
  },
  alertIcon:     { fontSize: 32 },
  alertTime:     { fontSize: 36, fontWeight: '900', letterSpacing: 2 },
  alertSub:      { color: MUTED, fontSize: 10, letterSpacing: 2 },
  alertMsg:      { color: MUTED, fontSize: 13, letterSpacing: 2 },
  alertWarn:     { fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  alertInfo:     { gap: 6, width: '100%' },
  alertRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertInfoText: { color: MUTED, fontSize: 10 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: '#0a1e2c',
    backgroundColor: '#070d14',
  },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  tabIcon:       { fontSize: 16, opacity: 0.35 },
  tabIconActive: { opacity: 1 },
  tabLabel:      { color: MUTED, fontSize: 7, fontWeight: '700', letterSpacing: 1 },
  tabLabelActive:{ color: BLUE },
});
