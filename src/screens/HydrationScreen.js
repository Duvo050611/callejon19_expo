import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList, Platform, StyleSheet, Text,
  TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG    = '#020c14';
const SURF  = '#071624';
const CARD  = '#0b1e30';
const LINE  = '#0e2840';
const BLUE  = '#38bdf8';
const DBLUE = '#0ea5e9';
const TEXT  = '#dde8f0';
const SUB   = '#4a7a96';
const MUTED = '#2a5070';
const GHOST = '#0a1929';
const GREEN = '#34d399';
const AMBER = '#fbbf24';
const RED   = '#f87171';

const TOP    = Platform.OS === 'ios' ? 52 : 28;
const BOT    = Platform.OS === 'ios' ? 34 : 16;
const GOAL_D = 2000;

const TABS = [
  { icon: '🏠', label: 'HOY'      },
  { icon: '💧', label: 'AGREGAR'  },
  { icon: '🎯', label: 'META'     },
  { icon: '📋', label: 'REGISTRO' },
  { icon: '📊', label: 'SEMANA'   },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmtElapsed(sec) {
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec/60)} min`;
  return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`;
}
function dateLabel() {
  const DAYS   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const d = new Date();
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function last7() {
  const a = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    a.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return a;
}

// ─── Ring SVG ─────────────────────────────────────────────────────────────────
function Ring({ current, goal, size }) {
  const r    = (size - 32) / 2;
  const cx   = size / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(current / goal, 1);
  const done = pct >= 1;
  const arc  = circ * pct;
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${cx},${cx}`}>
        <Circle cx={cx} cy={cx} r={r} stroke={LINE} strokeWidth={18} fill="none" />
        {pct > 0 && (
          <Circle cx={cx} cy={cx} r={r}
            stroke={done ? GREEN : BLUE} strokeWidth={18} fill="none"
            strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
          />
        )}
      </G>
    </Svg>
  );
}

// ─── Mini ring (header) ───────────────────────────────────────────────────────
function MiniRing({ pct, done }) {
  const r = 13; const circ = 2 * Math.PI * r;
  return (
    <Svg width={34} height={34}>
      <G rotation="-90" origin="17,17">
        <Circle cx="17" cy="17" r={r} stroke={LINE} strokeWidth={5} fill="none" />
        {pct > 0 && (
          <Circle cx="17" cy="17" r={r}
            stroke={done ? GREEN : BLUE} strokeWidth={5} fill="none"
            strokeDasharray={`${circ*pct} ${circ}`} strokeLinecap="round"
          />
        )}
      </G>
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HydrationScreen() {
  const { width } = useWindowDimensions();
  const W      = Math.min(width, 460);
  const ringSz = Math.min(W * 0.65, 230);

  const [tab,       setTab]       = useState(0);
  const [log,       setLog]       = useState([]);
  const [goal,      setGoal]      = useState(GOAL_D);
  const [history,   setHistory]   = useState({});
  const [lastDrink, setLastDrink] = useState(null);
  const [elapsed,   setElapsed]   = useState(0);
  const [loaded,    setLoaded]    = useState(false);
  const [flash,     setFlash]     = useState(null);
  const [error,     setError]     = useState(null);
  const timerRef   = useRef(null);
  const flashTimer = useRef(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [rg, rl, rh, rd] = await Promise.all([
          AsyncStorage.getItem('hyd_goal'),
          AsyncStorage.getItem(`hyd_log_${todayKey()}`),
          AsyncStorage.getItem('hyd_history'),
          AsyncStorage.getItem('hyd_lastDrink'),
        ]);
        if (rg) setGoal(parseInt(rg, 10));
        if (rl) setLog(JSON.parse(rl));
        if (rh) setHistory(JSON.parse(rh));
        if (rd) setLastDrink(parseInt(rd, 10));
      } catch (e) {
        setError('Error al cargar: ' + e.message);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Persist ───────────────────────────────────────────────────────────────
  async function persist(newLog, newGoal, newHist, newLast) {
    try {
      await Promise.all([
        AsyncStorage.setItem(`hyd_log_${todayKey()}`, JSON.stringify(newLog)),
        AsyncStorage.setItem('hyd_goal', String(newGoal)),
        AsyncStorage.setItem('hyd_history', JSON.stringify(newHist)),
        newLast != null
          ? AsyncStorage.setItem('hyd_lastDrink', String(newLast))
          : AsyncStorage.removeItem('hyd_lastDrink'),
      ]);
      setError(null);
    } catch (e) {
      setError('Error al guardar: ' + e.message);
    }
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(timerRef.current);
    if (lastDrink == null) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - lastDrink) / 1000));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [lastDrink]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function addWater(ml) {
    const ts     = Date.now();
    const entry  = { id: ts, ts, ml };
    const newLog = [entry, ...log];
    const key    = todayKey();
    const total  = newLog.reduce((s, e) => s + e.ml, 0);
    const newH   = { ...history, [key]: total };
    setLog(newLog); setHistory(newH); setLastDrink(ts);
    persist(newLog, goal, newH, ts);
    clearTimeout(flashTimer.current);
    setFlash(ml);
    flashTimer.current = setTimeout(() => setFlash(null), 1800);
  }

  function changeGoal(delta) {
    const next = Math.max(500, Math.min(5000, goal + delta));
    setGoal(next);
    persist(log, next, history, lastDrink);
  }

  function setGoalPreset(val) {
    setGoal(val);
    persist(log, val, history, lastDrink);
  }

  function clearToday() {
    const key  = todayKey();
    const newH = { ...history, [key]: 0 };
    setLog([]); setHistory(newH); setLastDrink(null);
    persist([], goal, newH, null);
  }

  if (!loaded) {
    return <View style={s.root}><Text style={s.loadTxt}>Cargando…</Text></View>;
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const today     = log.reduce((sum, e) => sum + e.ml, 0);
  const pct       = Math.min(today / goal, 1);
  const pctN      = Math.round(pct * 100);
  const remaining = Math.max(0, goal - today);
  const done      = pct >= 1;
  const alertMin  = lastDrink ? Math.floor(elapsed / 60) : null;
  const alertOn   = alertMin != null && alertMin >= 60;
  const alertWarn = alertMin != null && alertMin >= 30 && !alertOn;
  const alertClr  = alertOn ? RED : alertWarn ? AMBER : GREEN;
  const keys7     = last7();

  // ── Tab content ───────────────────────────────────────────────────────────
  const content = () => {
    switch (tab) {

      // HOY ──────────────────────────────────────────────────────────────────
      case 0: return (
        <View style={s.tab}>
          <Text style={s.dateStr}>{dateLabel()}</Text>

          {/* Hero ring */}
          <View style={s.ringWrap}>
            <Ring current={today} goal={goal} size={ringSz} />
            <View style={[s.ringInner, { width: ringSz, height: ringSz }]}>
              <Text style={[s.ringNum, done && { color: GREEN }]}>
                {today >= 1000 ? (today/1000).toFixed(1) : today}
              </Text>
              <Text style={s.ringUnit}>{today >= 1000 ? 'litros' : 'ml'}</Text>
              <Text style={[s.ringPct, { color: done ? GREEN : pct > 0.5 ? BLUE : SUB }]}>
                {pctN}%
              </Text>
            </View>
          </View>

          {/* Progress caption */}
          <Text style={s.caption}>
            {done ? '¡Meta alcanzada! 🎉' : `${remaining.toLocaleString()} ml para completar la meta`}
          </Text>

          {/* Alert strip */}
          <View style={[s.strip, { borderColor: alertClr + '35', backgroundColor: alertClr + '0d' }]}>
            <View style={[s.stripDot, { backgroundColor: alertClr }]} />
            <Text style={[s.stripTxt, { color: alertClr }]}>
              {lastDrink == null
                ? 'Registra tu primer vaso'
                : alertOn  ? `¡Bebe agua! Hace ${alertMin} min sin hidratarte`
                : alertWarn ? `Pronto toca hidratarte — ${alertMin} min`
                : `Último vaso hace ${fmtElapsed(elapsed)}`}
            </Text>
          </View>

          {/* Quick add */}
          <View style={s.quickRow}>
            {[150, 250, 500].map(ml => (
              <TouchableOpacity key={ml} activeOpacity={0.6}
                style={[s.quickBtn, flash === ml && s.quickBtnLit]}
                onPress={() => addWater(ml)}>
                <Text style={s.quickDrop}>💧</Text>
                <Text style={[s.quickVal, flash === ml && { color: BLUE }]}>+{ml}</Text>
                <Text style={s.quickU}>ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Flash pill */}
          {flash && (
            <View style={s.pill}>
              <Text style={s.pillTxt}>+{flash} ml registrados ✓</Text>
            </View>
          )}
        </View>
      );

      // AGREGAR ──────────────────────────────────────────────────────────────
      case 1: return (
        <View style={s.tab}>
          <View style={s.sHead}>
            <Text style={s.sTag}>REGISTRAR AGUA</Text>
            <Text style={s.sSub}>Selecciona la cantidad</Text>
          </View>

          <View style={s.grid}>
            {[100, 150, 250, 350, 500, 750].map(ml => (
              <TouchableOpacity key={ml} activeOpacity={0.65}
                style={[s.mlCard, flash === ml && s.mlCardLit]}
                onPress={() => addWater(ml)}>
                <Text style={s.mlDrop}>💧</Text>
                <Text style={[s.mlVal, flash === ml && { color: BLUE }]}>{ml}</Text>
                <Text style={s.mlU}>ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.sumRow}>
            {[
              { v: today.toLocaleString(), l: 'ml hoy' },
              { v: String(log.length),     l: 'vasos' },
              { v: remaining.toLocaleString(), l: 'ml faltan', c: done ? GREEN : remaining > goal*0.5 ? RED : AMBER },
            ].map((it, i) => (
              <View key={i} style={s.sumCell}>
                <Text style={[s.sumVal, it.c && { color: it.c }]}>{it.v}</Text>
                <Text style={s.sumLbl}>{it.l}</Text>
              </View>
            ))}
          </View>

          {flash && <View style={s.pill}><Text style={s.pillTxt}>+{flash} ml registrados ✓</Text></View>}
        </View>
      );

      // META ─────────────────────────────────────────────────────────────────
      case 2: {
        // ETA: pace so far today
        let etaStr = null;
        if (today > 0 && !done) {
          const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
          const elapsed_ms = Date.now() - startOfDay.getTime();
          if (elapsed_ms > 0) {
            const rate    = today / elapsed_ms; // ml/ms
            const msLeft  = remaining / rate;
            const etaMs   = Date.now() + msLeft;
            const etaD    = new Date(etaMs);
            if (msLeft < 18 * 3600000) {
              etaStr = `${String(etaD.getHours()).padStart(2,'0')}:${String(etaD.getMinutes()).padStart(2,'0')}`;
            }
          }
        }
        return (
          <View style={s.tab}>
            <View style={s.sHead}>
              <Text style={s.sTag}>META DIARIA</Text>
              <Text style={s.sSub}>Ajusta tu objetivo de hidratación</Text>
            </View>

            <View style={s.adjCard}>
              <TouchableOpacity style={s.adjBtn} onPress={() => changeGoal(-250)} activeOpacity={0.7}>
                <Text style={s.adjBtnTxt}>−</Text>
              </TouchableOpacity>
              <View style={s.adjCenter}>
                <Text style={s.adjBig}>{(goal/1000).toFixed(1)}</Text>
                <Text style={s.adjLitros}>litros</Text>
                <Text style={s.adjMl}>{goal.toLocaleString()} ml / día</Text>
              </View>
              <TouchableOpacity style={s.adjBtn} onPress={() => changeGoal(+250)} activeOpacity={0.7}>
                <Text style={s.adjBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={s.presets}>
              {[{ l: 'Mínimo', v: 1500 }, { l: 'Recomendado', v: 2000 }, { l: 'Activo', v: 3000 }].map(p => (
                <TouchableOpacity key={p.v} activeOpacity={0.7}
                  style={[s.preset, goal === p.v && s.presetOn]}
                  onPress={() => setGoalPreset(p.v)}>
                  <Text style={[s.presetL, goal === p.v && { color: BLUE }]}>{p.l}</Text>
                  <Text style={[s.presetV, goal === p.v && { color: BLUE }]}>{(p.v/1000).toFixed(1)}L</Text>
                </TouchableOpacity>
              ))}
            </View>

            {etaStr && (
              <View style={s.etaCard}>
                <Text style={s.etaIcon}>⏱</Text>
                <Text style={s.etaTxt}>
                  {'A este ritmo llegarás a tu meta a las '}
                  <Text style={{ color: BLUE, fontWeight: '800' }}>{etaStr}</Text>
                </Text>
              </View>
            )}
          </View>
        );
      }

      // REGISTRO ─────────────────────────────────────────────────────────────
      case 3: return (
        <View style={[s.tab, { paddingBottom: 0 }]}>
          <View style={s.regHead}>
            <View>
              <Text style={s.sTag}>REGISTRO HOY</Text>
              <Text style={s.sSub}>{log.length} entradas · {today.toLocaleString()} ml</Text>
            </View>
            {log.length > 0 && (
              <TouchableOpacity style={s.delBtn} onPress={clearToday} activeOpacity={0.7}>
                <Text style={s.delTxt}>Borrar todo</Text>
              </TouchableOpacity>
            )}
          </View>

          {log.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyGlyph}>🫙</Text>
              <Text style={s.emptyTitle}>Sin registros hoy</Text>
              <Text style={s.emptySub}>Toca Agregar para registrar</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setTab(1)}>
                <Text style={s.emptyBtnTxt}>Ir a Agregar →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={log}
              keyExtractor={e => String(e.id)}
              style={{ flex: 1, width: '100%' }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item }) => (
                <View style={s.logRow}>
                  <Text style={s.logTime}>{fmtTime(item.ts)}</Text>
                  <View style={s.logTrack}>
                    <View style={[s.logBar, { width: `${Math.min((item.ml/750)*100,100)}%` }]} />
                  </View>
                  <Text style={s.logMl}>+{item.ml} ml</Text>
                </View>
              )}
            />
          )}
        </View>
      );

      // SEMANA ───────────────────────────────────────────────────────────────
      case 4: {
        const vals   = keys7.map(k => history[k] || 0);
        const maxVal = Math.max(...vals, goal, 1);
        const BAR_H  = 120;
        const avg    = Math.round(vals.reduce((a,b) => a+b, 0) / 7);
        const metas  = vals.filter(v => v >= goal).length;
        const best   = Math.max(...vals);
        const today_ = todayKey();
        return (
          <View style={s.tab}>
            <View style={s.sHead}>
              <Text style={s.sTag}>ÚLTIMOS 7 DÍAS</Text>
              <Text style={s.sSub}>Progreso semanal de hidratación</Text>
            </View>

            <View style={[s.chartBox, { height: BAR_H + 40 }]}>
              {keys7.map((k, i) => {
                const val  = vals[i];
                const h    = Math.max(val > 0 ? 6 : 0, Math.round((val/maxVal)*BAR_H));
                const c    = val >= goal ? GREEN : val >= goal*0.5 ? BLUE : val > 0 ? DBLUE : LINE;
                const isT  = k === today_;
                const day  = k.slice(8);
                return (
                  <View key={k} style={s.barCol}>
                    <Text style={s.barValTxt}>
                      {val >= 1000 ? `${(val/1000).toFixed(1)}L` : val > 0 ? `${val}` : ''}
                    </Text>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                      <View style={[s.barFill, { height: h, backgroundColor: c }]} />
                    </View>
                    <Text style={[s.barDay, isT && { color: BLUE, fontWeight: '900' }]}>{day}</Text>
                    {isT && <View style={s.barDot} />}
                  </View>
                );
              })}
            </View>

            <View style={s.legend}>
              {[[GREEN,'Meta alcanzada'],[BLUE,'En progreso'],[LINE,'Sin registro']].map(([c,l]) => (
                <View key={l} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: c }]} />
                  <Text style={s.legendTxt}>{l}</Text>
                </View>
              ))}
            </View>

            <View style={s.statsRow}>
              {[
                { v: avg >= 1000 ? `${(avg/1000).toFixed(1)}L` : `${avg}ml`, l: 'promedio\ndiario' },
                { v: `${metas}/7`, l: 'metas\nlogradas', c: metas >= 5 ? GREEN : metas >= 3 ? BLUE : SUB },
                { v: best >= 1000 ? `${(best/1000).toFixed(1)}L` : `${best}ml`, l: 'mejor\ndía' },
              ].map((st, i) => (
                <View key={i} style={s.statCard}>
                  <Text style={[s.statV, st.c && { color: st.c }]}>{st.v}</Text>
                  <Text style={s.statL}>{st.l}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      }

      default: return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: TOP }]}>
        <View>
          <Text style={s.hTitle}>HIDRATACIÓN</Text>
          <Text style={s.hSub}>{pctN}% completado · {today.toLocaleString()} ml</Text>
        </View>
        <MiniRing pct={pct} done={done} />
      </View>

      {error && (
        <View style={s.errBanner}><Text style={s.errTxt}>{error}</Text></View>
      )}

      {/* Content */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ width: W, flex: 1 }}>{content()}</View>
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { paddingBottom: BOT }]}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={i} style={s.tabBtn} onPress={() => setTab(i)} activeOpacity={0.8}>
            {tab === i && <View style={s.tabLine} />}
            <Text style={[s.tabIco, tab === i && s.tabIcoOn]}>{t.icon}</Text>
            <Text style={[s.tabLbl, tab === i && s.tabLblOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  loadTxt: { color: SUB, fontSize: 14, textAlign: 'center', marginTop: 120 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: LINE,
    backgroundColor: SURF,
  },
  hTitle: { color: BLUE, fontSize: 10, fontWeight: '900', letterSpacing: 6 },
  hSub:   { color: MUTED, fontSize: 11, marginTop: 3 },

  errBanner: { margin: 12, backgroundColor: '#1a0505', borderRadius: 10, padding: 10 },
  errTxt:    { color: RED, fontSize: 12, textAlign: 'center' },

  // Tab content
  tab: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, gap: 14,
  },

  // Section header
  sHead: { alignSelf: 'flex-start', gap: 3 },
  sTag:  { color: BLUE, fontSize: 9, fontWeight: '900', letterSpacing: 5 },
  sSub:  { color: MUTED, fontSize: 11 },

  // HOY — ring
  dateStr:  { color: MUTED, fontSize: 12, letterSpacing: 2, alignSelf: 'flex-start' },
  ringWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringInner:{ position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringNum:  { color: TEXT, fontSize: 46, fontWeight: '900', lineHeight: 48 },
  ringUnit: { color: SUB, fontSize: 11, fontWeight: '700', letterSpacing: 3, marginTop: 2 },
  ringPct:  { fontSize: 15, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  caption:  { color: SUB, fontSize: 12, letterSpacing: 1 },

  // Alert strip
  strip:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, width: '100%' },
  stripDot: { width: 6, height: 6, borderRadius: 3 },
  stripTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Quick add
  quickRow: { flexDirection: 'row', gap: 10, width: '100%' },
  quickBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, gap: 2 },
  quickBtnLit: { borderColor: BLUE, backgroundColor: `${BLUE}12` },
  quickDrop: { fontSize: 20 },
  quickVal:  { color: TEXT, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  quickU:    { color: MUTED, fontSize: 9, letterSpacing: 2 },

  // Feedback pill
  pill:    { backgroundColor: `${GREEN}14`, borderRadius: 20, borderWidth: 1, borderColor: `${GREEN}40`, paddingVertical: 8, paddingHorizontal: 18 },
  pillTxt: { color: GREEN, fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  // AGREGAR — grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  mlCard:    { width: '30.5%', alignItems: 'center', paddingVertical: 18, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, gap: 4 },
  mlCardLit: { borderColor: BLUE, backgroundColor: `${BLUE}12` },
  mlDrop:    { fontSize: 22 },
  mlVal:     { color: TEXT, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  mlU:       { color: MUTED, fontSize: 9, letterSpacing: 2 },

  sumRow:  { flexDirection: 'row', backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, width: '100%' },
  sumCell: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  sumVal:  { color: TEXT, fontSize: 20, fontWeight: '900' },
  sumLbl:  { color: MUTED, fontSize: 9, letterSpacing: 2, marginTop: 3 },

  // META
  adjCard:   { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: LINE, paddingVertical: 24, paddingHorizontal: 20, width: '100%' },
  adjBtn:    { width: 48, height: 48, borderRadius: 24, backgroundColor: SURF, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  adjBtnTxt: { color: BLUE, fontSize: 26, fontWeight: '300', lineHeight: 30 },
  adjCenter: { flex: 1, alignItems: 'center' },
  adjBig:    { color: TEXT, fontSize: 54, fontWeight: '900', lineHeight: 56 },
  adjLitros: { color: SUB, fontSize: 11, letterSpacing: 3 },
  adjMl:     { color: MUTED, fontSize: 11, marginTop: 4 },

  presets:  { flexDirection: 'row', gap: 8, width: '100%' },
  preset:   { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: LINE },
  presetOn: { borderColor: BLUE, backgroundColor: `${BLUE}10` },
  presetL:  { color: MUTED, fontSize: 10, fontWeight: '800' },
  presetV:  { color: SUB, fontSize: 13, fontWeight: '900', marginTop: 2 },

  etaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: LINE, paddingVertical: 12, paddingHorizontal: 14, width: '100%' },
  etaIcon: { fontSize: 16 },
  etaTxt:  { color: MUTED, fontSize: 12, flex: 1, lineHeight: 18 },

  // REGISTRO
  regHead:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', marginBottom: 4 },
  delBtn:   { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: `${RED}10`, borderRadius: 8, borderWidth: 1, borderColor: `${RED}30` },
  delTxt:   { color: RED, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  logRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: LINE },
  logTime:  { color: MUTED, fontSize: 11, fontWeight: '700', width: 42 },
  logTrack: { flex: 1, height: 5, backgroundColor: GHOST, borderRadius: 3, overflow: 'hidden' },
  logBar:   { height: '100%', backgroundColor: BLUE, borderRadius: 3 },
  logMl:    { color: TEXT, fontSize: 12, fontWeight: '800', width: 62, textAlign: 'right' },

  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyGlyph:  { fontSize: 52, marginBottom: 4 },
  emptyTitle:  { color: TEXT, fontSize: 17, fontWeight: '700' },
  emptySub:    { color: MUTED, fontSize: 12 },
  emptyBtn:    { marginTop: 12, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: BLUE, backgroundColor: `${BLUE}10` },
  emptyBtnTxt: { color: BLUE, fontSize: 12, fontWeight: '800', letterSpacing: 2 },

  // SEMANA — chart
  chartBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, width: '100%', paddingBottom: 24 },
  barCol:   { flex: 1, alignItems: 'center', gap: 3 },
  barValTxt:{ color: MUTED, fontSize: 7, fontWeight: '700', minHeight: 12 },
  barFill:  { width: '100%', borderRadius: 5 },
  barDay:   { color: MUTED, fontSize: 9, fontWeight: '700', marginTop: 2 },
  barDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE },

  legend:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { color: MUTED, fontSize: 10 },

  statsRow: { flexDirection: 'row', gap: 8, width: '100%' },
  statCard: { flex: 1, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statV:    { color: TEXT, fontSize: 18, fontWeight: '900' },
  statL:    { color: MUTED, fontSize: 8, letterSpacing: 1, textAlign: 'center' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: SURF, borderTopWidth: 1, borderTopColor: LINE },
  tabBtn: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 4, position: 'relative' },
  tabLine:  { position: 'absolute', top: 0, width: 24, height: 2, backgroundColor: BLUE, borderRadius: 1 },
  tabIco:   { fontSize: 18, opacity: 0.28 },
  tabIcoOn: { opacity: 1 },
  tabLbl:   { color: MUTED, fontSize: 7, fontWeight: '800', letterSpacing: 1, marginTop: 3 },
  tabLblOn: { color: BLUE },
});
