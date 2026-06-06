import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';

// ─── Data ─────────────────────────────────────────────────────────────────────
const WORDS = [
  'TIBURON','GORILA','CONEJO','CAMELLO','DELFIN',
  'CANGURO','PALOMA','AGUILA','CIERVO','ABEJA',
  'PULPO','IGUANA','FLAMENCO','CASTOR','ORUGA',
  'LOMBRIZ','MURCIELAGO','JIRAFA','CEBRA','LEOPARDO',
  'TIGRE','LINCE','HALCON','KOALA','NUTRIA',
];
const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['Z','X','C','V','B','N','M'],
];
const MAX_WRONG = 6;
const RED  = '#e63946';
const AMBER= '#fbbf24';
const P1   = '#818cf8';
const P2   = '#fb7185';

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

// ─── Responsive sizes ─────────────────────────────────────────────────────────
const H_PAD   = 28;
const KEY_GAP = 5;
const ROW1    = 10;

function useSizes() {
  const { width, height } = useWindowDimensions();
  const isWeb     = Platform.OS === 'web';

  // Content width capped for web
  const contentW  = Math.min(width - H_PAD, isWeb ? 520 : width - H_PAD);

  // Status bar + safe area estimate
  const safeTop   = Platform.OS === 'ios' ? 44 : 24;
  const availH    = height - safeTop;

  // Keyboard: 3 rows + 2 gaps
  const keyW      = Math.max(22, Math.floor((contentW - KEY_GAP * (ROW1 - 1)) / ROW1));
  const keyH      = Math.min(46, Math.max(34, keyW + 10));
  const kbdH      = 3 * keyH + 2 * (KEY_GAP + 2);

  // Space reserved for fixed UI elements (header, hint, tiles, wrong, margins)
  const fixedH    = 44 + 14 + 56 + 24 + 60;  // header + hint + tiles + wrong + padding

  // Gallows gets the remaining height (with a max)
  const gallowsH  = Math.min(
    Math.max(120, availH - kbdH - fixedH),
    isWeb ? 220 : availH * 0.38,
  );
  const gallowsW  = Math.min(contentW, Math.round(gallowsH * (220 / 190)));
  const gsc       = gallowsW / 220;

  // Tile size: proportional to content width
  const tileW     = Math.max(24, Math.min(38, Math.floor((contentW - 6 * 11) / 12)));
  const tileH     = tileW + 6;

  return { width, height, contentW, availH, keyW, keyH, kbdH, gallowsW, gallowsH, gsc, tileW, tileH };
}

// ─── Gallows ──────────────────────────────────────────────────────────────────
function Gallows({ wrongCount }) {
  const { gallowsW, gallowsH, gsc, contentW } = useSizes();

  const bar = (ox, oy, ow, oh) => (
    <View style={{
      backgroundColor: '#c0c0c0', position: 'absolute',
      left: ox * gsc, top: oy * gsc,
      width: Math.max(1.5, ow * gsc),
      height: Math.max(1.5, oh * gsc),
    }} />
  );
  const limb = (ox, oy, ow, deg) => (
    <View style={{
      position: 'absolute',
      left: ox * gsc, top: oy * gsc,
      width: ow * gsc, height: Math.max(1.5, 2 * gsc),
      backgroundColor: '#c0c0c0',
      transform: [{ rotate: `${deg}deg` }],
    }} />
  );

  const pct      = (MAX_WRONG - wrongCount) / MAX_WRONG;
  const barColor = pct > 0.6 ? '#4ade80' : pct > 0.3 ? AMBER : RED;

  return (
    <View style={{ width: contentW, alignItems: 'center', marginBottom: 4 }}>
      {/* Corners */}
      <View style={[st.corner, { top: 0, left: (contentW - gallowsW) / 2, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[st.corner, { top: 0, right: (contentW - gallowsW) / 2, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[st.corner, { top: gallowsH - 14, left: (contentW - gallowsW) / 2, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[st.corner, { top: gallowsH - 14, right: (contentW - gallowsW) / 2, borderBottomWidth: 2, borderRightWidth: 2 }]} />

      {/* Canvas */}
      <View style={[st.canvas, { width: gallowsW, height: gallowsH }]}>
        {bar(10, 184, 80, 2)}
        {bar(46, 10, 2, 174)}
        {bar(46, 10, 100, 2)}
        {bar(144, 10, 2, 34)}

        {wrongCount >= 1 && (
          <View style={{
            position: 'absolute',
            left: 133 * gsc, top: 43 * gsc,
            width: 24 * gsc, height: 24 * gsc,
            borderRadius: 12 * gsc,
            borderWidth: Math.max(1.5, 2 * gsc),
            borderColor: '#c0c0c0',
          }} />
        )}
        {wrongCount >= 2 && bar(144, 67, 2, 44)}
        {wrongCount >= 3 && limb(116, 80, 36, 135)}
        {wrongCount >= 4 && limb(148, 80, 36, 45)}
        {wrongCount >= 5 && limb(112, 122, 42, 127)}
        {wrongCount >= 6 && limb(148, 122, 42, 53)}
      </View>

      {/* Life bar */}
      <View style={{ width: gallowsW, marginTop: 8 }}>
        <View style={st.lifeBarBg}>
          <View style={[st.lifeBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[st.lifeLabel, { color: barColor }]}>
          {MAX_WRONG - wrongCount} / {MAX_WRONG} VIDAS
        </Text>
      </View>
    </View>
  );
}

const GREEN = '#4ade80';

// ─── Menu ─────────────────────────────────────────────────────────────────────
function MenuScreen({ onSelect, onOnline }) {
  const { contentW } = useSizes();
  const titleSize = Math.min(52, contentW * 0.15);

  return (
    <View style={[st.menuRoot, { paddingHorizontal: H_PAD / 2 }]}>
      <View style={{ width: contentW }}>
        <Text style={st.brandSub}>— EL JUEGO DEL —</Text>
        <Text style={[st.brandTitle, { fontSize: titleSize }]}>AHORCADO</Text>
        <View style={st.brandLine} />
        <Text style={st.brandTag}>🐾 Animales · 25 palabras</Text>

        <View style={[st.menuCards, { marginTop: Math.min(48, contentW * 0.1) }]}>
          <TouchableOpacity style={[st.menuCard, { borderLeftColor: P1 }]} onPress={() => onSelect('1p')}>
            <Text style={st.menuCardNum}>01</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.menuCardTitle, { color: P1 }]}>1 JUGADOR</Text>
              <Text style={st.menuCardDesc}>Palabra al azar. Juega solo.</Text>
            </View>
            <Text style={[st.menuChev, { color: P1 }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[st.menuCard, { borderLeftColor: P2 }]} onPress={() => onSelect('2p')}>
            <Text style={st.menuCardNum}>02</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.menuCardTitle, { color: P2 }]}>2 JUGADORES</Text>
              <Text style={st.menuCardDesc}>Turnos alternados · Vidas compartidas</Text>
            </View>
            <Text style={[st.menuChev, { color: P2 }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[st.menuCard, { borderLeftColor: GREEN }]} onPress={onOnline}>
            <Text style={st.menuCardNum}>03</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.menuCardTitle, { color: GREEN }]}>ONLINE</Text>
              <Text style={st.menuCardDesc}>2 dispositivos · QR · Firebase</Text>
            </View>
            <Text style={[st.menuChev, { color: GREEN }]}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={st.menuFooter}>
          Pierde el turno al fallar · Gana quien descubra más letras
        </Text>
      </View>
    </View>
  );
}

// ─── Game ─────────────────────────────────────────────────────────────────────
function GameScreen({ word, mode, onBackToMenu }) {
  const { contentW, keyW, keyH, tileW, tileH, availH } = useSizes();

  const [guessed, setGuessed] = useState(new Set());
  const [player, setPlayer]   = useState(1);
  const [score, setScore]     = useState({ 1: 0, 2: 0 });

  // Block virtual keyboard on mobile
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Keyboard.dismiss();
    }
  }, []);

  const wrongLetters = [...guessed].filter((l) => !word.includes(l));
  const wrongCount   = wrongLetters.length;
  const won  = word.length > 0 && [...word].every((l) => guessed.has(l));
  const lost = wrongCount >= MAX_WRONG;
  const over = won || lost;

  // Physical keyboard (web only)
  const handlerRef = useRef(null);
  useEffect(() => { handlerRef.current = handleLetter; });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fn = (e) => {
      const raw = e.key.toUpperCase();
      const k = raw
        .replace('Á','A').replace('É','E').replace('Í','I')
        .replace('Ó','O').replace('Ú','U');
      if (/^[A-ZÑ]$/.test(k)) handlerRef.current(k);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  function handleLetter(letter) {
    if (over || guessed.has(letter)) return;
    const correct = word.includes(letter);
    if (correct) {
      const n = word.split('').filter((l) => l === letter).length;
      setScore((p) => ({ ...p, [player]: p[player] + n }));
    }
    setGuessed((prev) => new Set([...prev, letter]));
    if (mode === '2p' && !correct) setPlayer((p) => (p === 1 ? 2 : 1));
  }

  const pColor = mode === '2p' ? (player === 1 ? P1 : P2) : RED;

  const inner = (
    <View style={[st.gameInner, { paddingHorizontal: H_PAD / 2 }]}>
      <View style={{ width: contentW, flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Header */}
        <View style={[st.header, { width: contentW }]}>
          <TouchableOpacity onPress={onBackToMenu} style={st.backWrap}>
            <Text style={st.backArrow}>←</Text>
            <Text style={st.backText}>MENÚ</Text>
          </TouchableOpacity>
          <Text style={st.gameTitle}>AHORCADO</Text>
          <Text style={st.headerMode}>{mode === '2p' ? '2P' : '1P'}</Text>
        </View>

        {/* Turn banner */}
        {mode === '2p' && !over && (
          <View style={[st.turnBanner, { borderColor: pColor, backgroundColor: pColor + '18', width: contentW }]}>
            <View style={[st.turnDot, { backgroundColor: pColor }]} />
            <Text style={[st.turnLabel, { color: pColor }]}>JUGADOR {player}</Text>
            <Text style={[st.tScore, { color: P1 }]}>J1·{score[1]}</Text>
            <Text style={st.tSep}>|</Text>
            <Text style={[st.tScore, { color: P2 }]}>J2·{score[2]}</Text>
          </View>
        )}

        {/* Gallows */}
        <Gallows wrongCount={wrongCount} />

        {/* Category */}
        <Text style={st.categoryTag}>🐾  ANIMALES</Text>

        {/* Word tiles */}
        <View style={[st.wordStrip, { width: contentW }]}>
          {[...word].map((letter, i) => {
            const hit  = guessed.has(letter);
            const miss = lost && !hit;
            return (
              <View key={i} style={[
                st.tile,
                { width: tileW, height: tileH },
                hit  && st.tileHit,
                miss && st.tileMiss,
              ]}>
                <Text style={[
                  st.tileLetter,
                  { fontSize: Math.max(11, tileW * 0.52) },
                  hit  && st.tileLetterHit,
                  miss && st.tileLetterMiss,
                ]}>
                  {hit || lost ? letter : ''}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Wrong letters */}
        <View style={st.wrongRow}>
          {wrongLetters.length > 0 && (
            <>
              <Text style={st.wrongLabel}>FALLADAS: </Text>
              <Text style={st.wrongLetters}>{wrongLetters.join(' · ')}</Text>
            </>
          )}
        </View>

        {/* Game over */}
        {over && (
          <View style={[st.overBox, { width: contentW }]}>
            <View style={[st.overBadge, { borderColor: won ? '#4ade80' : RED }]}>
              <Text style={st.overEmoji}>{won ? '🎉' : '💀'}</Text>
              <Text style={[st.overTitle, { color: won ? '#4ade80' : RED }]}>
                {won
                  ? (mode === '2p' ? '¡GANARON!' : '¡GANASTE!')
                  : (mode === '2p' ? '¡PERDIERON!' : '¡PERDISTE!')}
              </Text>
            </View>
            {mode === '2p' && (
              <View style={[st.resultCards, { width: contentW }]}>
                {[1,2].map((p) => (
                  <View key={p} style={[st.resultCard, { borderColor: p===1?P1:P2, flex:1 }]}>
                    <Text style={[st.rcNum, { color: p===1?P1:P2 }]}>J{p}</Text>
                    <Text style={st.rcScore}>{score[p]}</Text>
                    <Text style={st.rcLetras}>letras</Text>
                  </View>
                ))}
              </View>
            )}
            {mode === '2p' && (
              <Text style={st.winnerLine}>
                {score[1]>score[2]?'🏆 Jugador 1 gana':score[2]>score[1]?'🏆 Jugador 2 gana':'🤝 Empate'}
              </Text>
            )}
            <TouchableOpacity style={[st.replayBtn, { width: contentW }]} onPress={onBackToMenu}>
              <Text style={st.replayText}>JUGAR DE NUEVO</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Keyboard */}
        {!over && (
          <View style={st.kbd}>
            {KEYBOARD_ROWS.map((row, ri) => (
              <View key={ri} style={[st.kbdRow, { gap: KEY_GAP }]}>
                {row.map((letter) => {
                  const used    = guessed.has(letter);
                  const correct = used && word.includes(letter);
                  const wrong   = used && !word.includes(letter);
                  return (
                    <TouchableOpacity
                      key={letter}
                      activeOpacity={0.7}
                      style={[
                        st.key,
                        { width: keyW, height: keyH },
                        correct && st.keyOk,
                        wrong   && st.keyBad,
                      ]}
                      onPress={() => handleLetter(letter)}
                      disabled={used}
                    >
                      <Text style={[
                        st.keyText,
                        { fontSize: Math.max(10, keyW * 0.38) },
                        used    && st.keyTextUsed,
                        correct && st.keyTextOk,
                      ]}>
                        {letter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}

      </View>
    </View>
  );

  // On mobile: fixed layout (no scroll, no keyboard popup)
  // On web: scrollable for smaller browser windows
  if (Platform.OS !== 'web') {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={st.gameRoot}>{inner}</View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: '#080808' }}
      contentContainerStyle={st.gameRootScroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      {inner}
    </ScrollView>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function HangmanScreen({ onOnline }) {
  const [phase, setPhase] = useState('menu');
  const [mode, setMode]   = useState(null);
  const [word, setWord]   = useState('');

  function start(m) { setMode(m); setWord(randomWord()); setPhase('playing'); }
  function back()   { setPhase('menu'); setMode(null); setWord(''); }

  if (phase === 'menu') return <MenuScreen onSelect={start} onOnline={onOnline} />;
  return <GameScreen word={word} mode={mode} onBackToMenu={back} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const BG    = '#080808';
const CARD  = '#141414';
const BORDER= '#242424';
const DIM   = '#2e2e2e';

const st = StyleSheet.create({
  // Menu
  menuRoot: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },
  brandSub: { color: '#3a3a3a', fontSize: 11, letterSpacing: 5, fontWeight: '700', marginBottom: 4 },
  brandTitle: { fontWeight: '900', color: '#f0f0f0', letterSpacing: 8, lineHeight: 56 },
  brandLine: { width: 64, height: 3, backgroundColor: RED, marginTop: 12, marginBottom: 10 },
  brandTag: { color: '#363636', fontSize: 12, letterSpacing: 2 },
  menuCards: { gap: 10 },
  menuCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CARD, borderRadius: 12, padding: 20,
    borderLeftWidth: 3,
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderTopColor: BORDER, borderRightColor: BORDER, borderBottomColor: BORDER,
  },
  menuCardNum: { color: DIM, fontSize: 11, fontWeight: '800', letterSpacing: 2, minWidth: 22 },
  menuCardTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 3, marginBottom: 2 },
  menuCardDesc: { color: '#404040', fontSize: 12 },
  menuChev: { fontSize: 24, fontWeight: '300' },
  menuFooter: { color: '#252525', fontSize: 11, letterSpacing: 1, marginTop: 32, textAlign: 'center' },

  // Game — mobile: flex fills screen; web: scroll
  gameRoot: {
    flex: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },
  gameRootScroll: {
    flexGrow: 1, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40,
  },
  gameInner: {
    flex: 1, width: '100%',
    alignItems: 'center', justifyContent: 'center',
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow: { color: '#3a3a3a', fontSize: 18 },
  backText: { color: '#3a3a3a', fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  gameTitle: { flex: 1, textAlign: 'center', color: '#1e1e1e', fontSize: 13, fontWeight: '900', letterSpacing: 6 },
  headerMode: { color: '#3a3a3a', fontSize: 11, fontWeight: '800', letterSpacing: 3 },

  // Turn
  turnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14, marginBottom: 8,
  },
  turnDot: { width: 6, height: 6, borderRadius: 3 },
  turnLabel: { flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  tScore: { fontSize: 11, fontWeight: '800' },
  tSep: { color: '#2a2a2a', fontSize: 12 },

  // Gallows
  corner: { position: 'absolute', width: 14, height: 14, borderColor: '#222' },
  canvas: {
    backgroundColor: '#101010', borderRadius: 4,
    borderWidth: 1, borderColor: '#181818',
    position: 'relative', overflow: 'hidden',
  },
  lifeBarBg: { width: '100%', height: 3, backgroundColor: '#181818', borderRadius: 2, overflow: 'hidden' },
  lifeBarFill: { height: '100%', borderRadius: 2 },
  lifeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 4, textAlign: 'center' },

  // Category
  categoryTag: { color: '#606060', fontSize: 10, letterSpacing: 4, fontWeight: '700', marginVertical: 8 },

  // Tiles
  wordStrip: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginBottom: 8 },
  tile: {
    backgroundColor: '#101010', borderBottomWidth: 2, borderBottomColor: '#252525',
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2,
  },
  tileHit:  { borderBottomColor: '#f0f0f0' },
  tileMiss: { borderBottomColor: RED },
  tileLetter: { fontWeight: '900', color: 'transparent' },
  tileLetterHit:  { color: '#f0f0f0' },
  tileLetterMiss: { color: RED },

  // Wrong
  wrongRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, height: 20 },
  wrongLabel: { color: '#303030', fontSize: 9, fontWeight: '800', letterSpacing: 3 },
  wrongLetters: { color: '#3a3a3a', fontSize: 11, fontWeight: '700', letterSpacing: 3 },

  // Over
  overBox: { alignItems: 'center', marginVertical: 6 },
  overBadge: {
    alignItems: 'center', borderWidth: 1, borderRadius: 12,
    paddingVertical: 14, marginBottom: 12, width: '100%', backgroundColor: CARD,
  },
  overEmoji: { fontSize: 32, marginBottom: 4 },
  overTitle: { fontSize: 26, fontWeight: '900', letterSpacing: 6 },
  resultCards: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  resultCard: {
    alignItems: 'center', backgroundColor: CARD,
    borderRadius: 12, paddingVertical: 12, borderWidth: 1,
  },
  rcNum: { fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 6 },
  rcScore: { fontSize: 36, fontWeight: '900', color: '#f0f0f0', lineHeight: 38 },
  rcLetras: { fontSize: 9, color: '#383838', letterSpacing: 2, marginTop: 2 },
  winnerLine: { color: '#505050', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 14 },
  replayBtn: { borderWidth: 1, borderColor: '#303030', paddingVertical: 13, borderRadius: 4, alignItems: 'center' },
  replayText: { color: '#f0f0f0', fontSize: 11, fontWeight: '900', letterSpacing: 6 },

  // Keyboard
  kbd: { alignItems: 'center', gap: 6, marginTop: 8 },
  kbdRow: { flexDirection: 'row' },
  key: {
    backgroundColor: CARD, borderRadius: 6,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderTopColor: '#2a2a2a', borderLeftColor: '#222', borderRightColor: '#111',
    borderBottomWidth: 3, borderBottomColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  keyOk:  { backgroundColor: '#0d1f0d', borderTopColor: '#1a3a1a' },
  keyBad: { backgroundColor: '#160808', borderTopColor: '#2e1010' },
  keyText:     { color: '#505050', fontWeight: '800' },
  keyTextUsed: { color: '#202020' },
  keyTextOk:   { color: '#4ade80' },
});
