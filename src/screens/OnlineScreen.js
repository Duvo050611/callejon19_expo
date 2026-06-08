import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  createRoom, joinRoom, updateMyState,
  processRoundEnd, startNextRound,
  subscribeToRoom, generateRoomId,
} from '../firebase/gameService';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_WRONG  = 6;
const WIN_SCORE  = 3;
const RED        = '#e63946';
const AMBER      = '#fbbf24';
const GREEN      = '#4ade80';
const P1         = '#818cf8';
const P2         = '#fb7185';
const BG         = '#080808';
const CARD       = '#141414';
const BORDER     = '#242424';

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['Z','X','C','V','B','N','M'],
];

const KEY_GAP = 5;
const ROW1    = 10;

function useSizes() {
  const { width, height } = useWindowDimensions();
  const isWeb    = Platform.OS === 'web';
  const contentW = Math.min(width - 28, isWeb ? 520 : width - 28);
  const safeTop  = Platform.OS === 'ios' ? 44 : 24;
  const availH   = height - safeTop;
  const keyW     = Math.max(22, Math.floor((contentW - KEY_GAP * (ROW1 - 1)) / ROW1));
  const keyH     = Math.min(46, Math.max(34, keyW + 10));
  const kbdH     = 3 * keyH + 2 * (KEY_GAP + 2);
  const fixedH   = 44 + 38 + 26 + 56 + 24 + 60;
  const gallowsH = Math.min(Math.max(100, availH - kbdH - fixedH), isWeb ? 200 : availH * 0.32);
  const gallowsW = Math.min(contentW, Math.round(gallowsH * (220 / 190)));
  const gsc      = gallowsW / 220;
  const tileW    = Math.max(22, Math.min(36, Math.floor((contentW - 6 * 11) / 12)));
  const tileH    = tileW + 6;
  return { width, height, contentW, availH, keyW, keyH, gallowsW, gallowsH, gsc, tileW, tileH };
}

// ─── Gallows (mismo que HangmanScreen) ───────────────────────────────────────
function Gallows({ wrongCount }) {
  const { gallowsW, gallowsH, gsc, contentW } = useSizes();

  const bar = (ox, oy, ow, oh) => (
    <View style={{
      backgroundColor: '#c0c0c0', position: 'absolute',
      left: ox * gsc, top: oy * gsc,
      width: Math.max(1.5, ow * gsc), height: Math.max(1.5, oh * gsc),
    }} />
  );
  const limb = (ox, oy, ow, deg) => (
    <View style={{
      position: 'absolute', left: ox * gsc, top: oy * gsc,
      width: ow * gsc, height: Math.max(1.5, 2 * gsc),
      backgroundColor: '#c0c0c0', transform: [{ rotate: `${deg}deg` }],
    }} />
  );

  const pct      = (MAX_WRONG - wrongCount) / MAX_WRONG;
  const barColor = pct > 0.6 ? GREEN : pct > 0.3 ? AMBER : RED;

  return (
    <View style={{ width: contentW, alignItems: 'center', marginBottom: 4 }}>
      <View style={[s.corner, { top: 0, left: (contentW - gallowsW) / 2, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[s.corner, { top: 0, right: (contentW - gallowsW) / 2, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[s.corner, { top: gallowsH - 14, left: (contentW - gallowsW) / 2, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[s.corner, { top: gallowsH - 14, right: (contentW - gallowsW) / 2, borderBottomWidth: 2, borderRightWidth: 2 }]} />

      <View style={[s.canvas, { width: gallowsW, height: gallowsH }]}>
        {bar(10, 184, 80, 2)}
        {bar(46, 10, 2, 174)}
        {bar(46, 10, 100, 2)}
        {bar(144, 10, 2, 34)}
        {wrongCount >= 1 && (
          <View style={{
            position: 'absolute', left: 133 * gsc, top: 43 * gsc,
            width: 24 * gsc, height: 24 * gsc, borderRadius: 12 * gsc,
            borderWidth: Math.max(1.5, 2 * gsc), borderColor: '#c0c0c0',
          }} />
        )}
        {wrongCount >= 2 && bar(144, 67, 2, 44)}
        {wrongCount >= 3 && limb(116, 80, 36, 135)}
        {wrongCount >= 4 && limb(148, 80, 36, 45)}
        {wrongCount >= 5 && limb(112, 122, 42, 127)}
        {wrongCount >= 6 && limb(148, 122, 42, 53)}
      </View>

      <View style={{ width: gallowsW, marginTop: 8 }}>
        <View style={s.lifeBarBg}>
          <View style={[s.lifeBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[s.lifeLabel, { color: barColor }]}>
          {MAX_WRONG - wrongCount} / {MAX_WRONG} VIDAS
        </Text>
      </View>
    </View>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
function LobbyScreen({ onBack, onCreate, onJoin }) {
  const { contentW } = useSizes();
  return (
    <View style={s.centered}>
      <View style={{ width: contentW }}>
        <TouchableOpacity onPress={onBack} style={s.backWrap}>
          <Text style={s.backText}>← MENÚ</Text>
        </TouchableOpacity>

        <Text style={s.brandSub}>MODO</Text>
        <Text style={s.brandTitle}>ONLINE</Text>
        <View style={s.brandLine} />
        <Text style={s.brandTag}>Juega contra alguien en otro dispositivo</Text>

        <View style={{ gap: 12, marginTop: 40 }}>
          <TouchableOpacity style={[s.modeCard, { borderLeftColor: P1 }]} onPress={onCreate}>
            <Text style={s.modeEmoji}>📡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.modeTitle, { color: P1 }]}>CREAR SALA</Text>
              <Text style={s.modeDesc}>Genera un QR para que el rival se una</Text>
            </View>
            <Text style={[s.modeChev, { color: P1 }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.modeCard, { borderLeftColor: P2 }]} onPress={onJoin}>
            <Text style={s.modeEmoji}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.modeTitle, { color: P2 }]}>UNIRSE</Text>
              <Text style={s.modeDesc}>Escanea el QR o escribe el código</Text>
            </View>
            <Text style={[s.modeChev, { color: P2 }]}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.ruleText}>
          ✦ +1 punto al adivinar la palabra{'\n'}
          ✦ Si nadie adivina → +1 a ambos{'\n'}
          ✦ Primero en llegar a {WIN_SCORE} puntos gana
        </Text>
      </View>
    </View>
  );
}

// ─── Create room ──────────────────────────────────────────────────────────────
function CreateRoomScreen({ onBack, onGameReady }) {
  const { contentW } = useSizes();
  const [roomId]             = useState(generateRoomId);
  const [ready, setReady]    = useState(false);
  const [errorMsg, setError] = useState(null);
  const unsubRef = useRef(null);

  function setup(rid) {
    setReady(false);
    setError(null);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject({ code: 'timeout' }), 30000)
    );

    Promise.race([createRoom(rid), timeout])
      .then(() => {
        setReady(true);
        unsubRef.current = subscribeToRoom(rid, (data) => {
          if (data.status === 'playing') {
            unsubRef.current?.();
            onGameReady(rid, 'p1', data.word);
          }
        });
      })
      .catch((e) => {
        const code = e?.code ?? '';
        const msg  = e?.message ?? '';
        if (code === 'timeout') {
          setError('Tiempo agotado conectando a Firebase.\nVerifica tu internet y que la base de datos Firestore esté creada en Firebase Console.');
        } else if (code.includes('permission') || msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
          setError('Acceso denegado.\nVerifica las reglas en Firebase Console → Firestore → Rules.');
        } else if (code.includes('unavailable') || msg.includes('unavailable')) {
          setError('Firestore no disponible.\n¿Creaste la base de datos en Firebase Console?');
        } else {
          setError((msg || code || 'Error desconocido'));
        }
      });
  }

  useEffect(() => {
    setup(roomId);
    return () => { unsubRef.current?.(); };
  }, []);

  return (
    <View style={s.centered}>
      <View style={{ width: contentW, alignItems: 'center' }}>
        <TouchableOpacity onPress={onBack} style={[s.backWrap, { alignSelf: 'flex-start' }]}>
          <Text style={s.backText}>← ATRÁS</Text>
        </TouchableOpacity>

        <Text style={[s.sectionTitle, { marginTop: 24 }]}>TU SALA</Text>

        {errorMsg ? (
          <>
            <Text style={[s.errorText, { marginTop: 32 }]}>{errorMsg}</Text>
            <TouchableOpacity style={[s.replayBtn, { marginTop: 20, width: contentW }]} onPress={onBack}>
              <Text style={s.replayText}>VOLVER</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* QR shown immediately — room writes in background */}
            <View style={s.qrBox}>
              <QRCode
                value={roomId}
                size={180}
                color="#f0f0f0"
                backgroundColor="#141414"
              />
            </View>

            <Text style={s.roomCode}>{roomId}</Text>
            <Text style={s.roomHint}>Comparte este código o QR con tu rival</Text>

            <View style={s.waitingRow}>
              <ActivityIndicator color={ready ? P1 : '#404040'} size="small" />
              <Text style={s.waitingText}>
                {ready ? 'Esperando al rival…' : 'Conectando con Firebase…'}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Join room ────────────────────────────────────────────────────────────────
function JoinRoomScreen({ onBack, onGameReady }) {
  const { contentW } = useSizes();
  const [mode, setMode]       = useState('choice'); // choice | scan | type
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  async function handleJoin(roomId) {
    if (loading || !roomId.trim()) return;
    setLoading(true);
    try {
      const word = await joinRoom(roomId.trim().toUpperCase());
      onGameReady(roomId.trim().toUpperCase(), 'p2', word);
    } catch (e) {
      Alert.alert('Error', e.message);
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  function handleBarCode({ data }) {
    if (scanned) return;
    setScanned(true);
    handleJoin(data);
  }

  async function handleScanPress() {
    if (!permission?.granted) await requestPermission();
    setMode('scan');
  }

  if (mode === 'scan') {
    if (!permission?.granted) {
      return (
        <View style={s.centered}>
          <Text style={s.errorText}>Permiso de cámara denegado.</Text>
          <TouchableOpacity onPress={onBack} style={s.replayBtn}>
            <Text style={s.replayText}>VOLVER</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarCode}
        />
        <View style={s.scanOverlay}>
          <View style={s.scanFrame} />
          <Text style={s.scanHint}>Apunta al QR del rival</Text>
        </View>
        <TouchableOpacity style={s.scanBack} onPress={() => setMode('choice')}>
          <Text style={s.backText}>← ATRÁS</Text>
        </TouchableOpacity>
        {loading && <ActivityIndicator color="#fff" style={{ position: 'absolute', bottom: 100, alignSelf: 'center' }} />}
      </View>
    );
  }

  return (
    <View style={s.centered}>
      <View style={{ width: contentW }}>
        <TouchableOpacity onPress={onBack} style={s.backWrap}>
          <Text style={s.backText}>← ATRÁS</Text>
        </TouchableOpacity>

        <Text style={[s.brandSub, { marginTop: 24 }]}>UNIRSE A</Text>
        <Text style={s.brandTitle}>SALA</Text>
        <View style={s.brandLine} />

        {mode === 'choice' && (
          <View style={{ gap: 12, marginTop: 36 }}>
            <TouchableOpacity style={[s.modeCard, { borderLeftColor: P2 }]} onPress={handleScanPress}>
              <Text style={s.modeEmoji}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.modeTitle, { color: P2 }]}>ESCANEAR QR</Text>
                <Text style={s.modeDesc}>Apunta la cámara al QR del rival</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[s.modeCard, { borderLeftColor: '#555' }]} onPress={() => setMode('type')}>
              <Text style={s.modeEmoji}>⌨️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.modeTitle, { color: '#888' }]}>ESCRIBIR CÓDIGO</Text>
                <Text style={s.modeDesc}>Escribe el código de 6 letras</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'type' && (
          <View style={{ marginTop: 36, alignItems: 'center', gap: 16 }}>
            <TextInput
              style={s.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="CÓDIGO"
              placeholderTextColor="#2a2a2a"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <TouchableOpacity
              style={[s.replayBtn, { opacity: code.length < 6 || loading ? 0.4 : 1, width: '100%' }]}
              onPress={() => handleJoin(code)}
              disabled={code.length < 6 || loading}
            >
              {loading
                ? <ActivityIndicator color="#f0f0f0" />
                : <Text style={s.replayText}>UNIRSE →</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Online game ──────────────────────────────────────────────────────────────
function OnlineGame({ roomId, player, initialWord, onBack }) {
  const sizes     = useSizes();
  const contentW  = sizes.contentW;
  const opponent  = player === 'p1' ? 'p2' : 'p1';

  const [room, setRoom]       = useState(null);
  const [guessed, setGuessed] = useState(new Set());
  const [countdown, setCount] = useState(null);
  const processedRef = useRef(false);
  const unsubRef     = useRef(null);

  // Subscribe to room
  useEffect(() => {
    unsubRef.current = subscribeToRoom(roomId, setRoom);
    return () => unsubRef.current?.();
  }, []);

  // Reset my state on new round (when room.word changes)
  const wordRef = useRef(initialWord);
  useEffect(() => {
    if (!room) return;
    if (room.word !== wordRef.current) {
      wordRef.current = room.word;
      setGuessed(new Set());
      processedRef.current = false;
    }
  }, [room?.word]);

  // Detect round end — solo P1 puntúa (REST API no tiene transacciones)
  useEffect(() => {
    if (!room) return;
    if (room.status !== 'playing') return;
    if (player !== 'p1') return;
    const me  = room[player];
    const opp = room[opponent];
    if (!me || !opp) return;
    if (me.status !== 'playing' && opp.status !== 'playing' && opp.status !== 'waiting') {
      if (!processedRef.current) {
        processedRef.current = true;
        processRoundEnd(roomId).catch(console.error);
      }
    }
  }, [room]);

  // Round over countdown (P1 advances the round)
  useEffect(() => {
    if (room?.status !== 'round_over') { setCount(null); return; }
    setCount(4);
  }, [room?.status]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      if (player === 'p1') startNextRound(roomId).catch(console.error);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Physical keyboard (web)
  const handlerRef = useRef(null);
  useEffect(() => { handlerRef.current = handleLetter; });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fn = (e) => {
      const raw = e.key.toUpperCase();
      const k = raw.replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U');
      if (/^[A-ZÑ]$/.test(k)) handlerRef.current(k);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  async function handleLetter(letter) {
    if (!room || room.status !== 'playing') return;
    const me = room[player];
    if (!me || me.status !== 'playing') return;
    if (guessed.has(letter)) return;

    // Guard against local win/lost computed before Firestore round-trips
    const wordNow  = room.word;
    const localWrongs = [...guessed].filter((l) => !wordNow.includes(l)).length;
    const localWon    = [...wordNow].every((l) => guessed.has(l));
    if (localWon || localWrongs >= MAX_WRONG) return;

    const word    = wordNow;
    const next    = new Set([...guessed, letter]);
    const correct = word.includes(letter);
    const wrongs  = [...next].filter((l) => !word.includes(l)).length;
    const won     = [...word].every((l) => next.has(l));
    const lost    = wrongs >= MAX_WRONG;
    const status  = won ? 'won' : lost ? 'lost' : 'playing';

    setGuessed(next);
    try {
      await updateMyState(roomId, player, [...next], status);
    } catch (e) {
      console.error(e);
    }
  }

  if (!room) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={P1} size="large" />
        <Text style={[s.waitingText, { marginTop: 12 }]}>Conectando…</Text>
      </View>
    );
  }

  // ── Game over ──
  if (room.status === 'finished') {
    const isWinner = room.winner === player;
    const isDraw   = room.winner === 'draw';
    return (
      <View style={s.centered}>
        <View style={{ width: contentW, alignItems: 'center' }}>
          <Text style={s.overEmoji}>{isDraw ? '🤝' : isWinner ? '🏆' : '💀'}</Text>
          <Text style={[s.overTitle, { color: isDraw ? AMBER : isWinner ? GREEN : RED }]}>
            {isDraw ? '¡EMPATE!' : isWinner ? '¡GANASTE!' : '¡PERDISTE!'}
          </Text>
          <View style={s.scoreCards}>
            {['p1','p2'].map((p) => (
              <View key={p} style={[s.scoreCard, { borderColor: p==='p1'?P1:P2, flex:1 }]}>
                <Text style={[s.scNum, { color: p==='p1'?P1:P2 }]}>{p==='p1'?'J1':'J2'}</Text>
                <Text style={s.scScore}>{room[p]?.score ?? 0}</Text>
                <Text style={s.scSub}>pts</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={[s.replayBtn, { width: contentW }]} onPress={onBack}>
            <Text style={s.replayText}>VOLVER AL MENÚ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Round over countdown ──
  if (room.status === 'round_over') {
    const p1Won  = room.p1?.status === 'won';
    const p2Won  = room.p2?.status === 'won';
    const bothL  = room.p1?.status === 'lost' && room.p2?.status === 'lost';
    return (
      <View style={s.centered}>
        <View style={{ width: contentW, alignItems: 'center' }}>
          <Text style={s.roundOverTitle}>RONDA {room.round - 1}</Text>
          <View style={s.scoreCards}>
            {['p1','p2'].map((p) => (
              <View key={p} style={[s.scoreCard, { borderColor: p==='p1'?P1:P2, flex:1 }]}>
                <Text style={[s.scNum, { color: p==='p1'?P1:P2 }]}>{p==='p1'?'J1':'J2'}</Text>
                <Text style={s.scScore}>{room[p]?.score ?? 0}</Text>
                <Text style={s.scSub}>pts</Text>
              </View>
            ))}
          </View>
          <Text style={s.roundResult}>
            {bothL ? '⚡ Nadie adivinó — +1 a ambos'
              : p1Won && p2Won ? '⚡ Ambos adivinaron — +1 a cada uno'
              : p1Won ? `⚡ J1 adivinó — +1 a J1`
              : p2Won ? `⚡ J2 adivinó — +1 a J2`
              : ''}
          </Text>
          <Text style={[s.countdown, { color: AMBER }]}>{countdown ?? '…'}</Text>
          <Text style={s.waitingText}>Siguiente ronda…</Text>
        </View>
      </View>
    );
  }

  // ── Waiting for opponent ──
  if (room.status === 'waiting') {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={P1} size="large" />
        <Text style={[s.waitingText, { marginTop: 16 }]}>Esperando al rival…</Text>
      </View>
    );
  }

  // ── Main game ──
  const { keyW, keyH, tileW, tileH } = sizes;

  const word      = room.word || initialWord;
  const me        = room[player]   || { score: 0, guessed: [], status: 'playing' };
  const opp       = room[opponent] || { score: 0, guessed: [], status: 'playing' };
  const myColor   = player   === 'p1' ? P1 : P2;
  const oppColor  = opponent === 'p1' ? P1 : P2;

  const wrongLetters = [...guessed].filter((l) => !word.includes(l));
  const wrongs       = wrongLetters.length;
  const won          = me.status === 'won'  || (word && [...word].every((l) => guessed.has(l)));
  const lost         = me.status === 'lost' || wrongs >= MAX_WRONG;
  const myDone       = me.status !== 'playing' || won || lost;
  const over         = won || lost;

  const oppWrongs = opp.guessed ? opp.guessed.filter((l) => !word.includes(l)).length : 0;
  const oppDone   = opp.status === 'won' || opp.status === 'lost';

  const inner = (
    <View style={[s.gameInner, { paddingHorizontal: 14 }]}>
      <View style={{ width: contentW, flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Header */}
        <View style={[s.header, { width: contentW }]}>
          <TouchableOpacity onPress={onBack} style={s.backWrap}>
            <Text style={s.backArrow}>←</Text>
            <Text style={s.backText}>SALIR</Text>
          </TouchableOpacity>
          <Text style={s.gameTitle}>AHORCADO</Text>
          <Text style={s.headerMode}>ONLINE · R{room.round}</Text>
        </View>

        {/* Player banner — igual al turn banner offline */}
        <View style={[s.turnBanner, { borderColor: myColor, backgroundColor: myColor + '18', width: contentW }]}>
          <View style={[s.turnDot, { backgroundColor: myDone ? '#333' : myColor }]} />
          <Text style={[s.turnLabel, { color: myDone ? '#444' : myColor }]}>
            TÚ · J{player === 'p1' ? 1 : 2}
          </Text>
          <Text style={[s.tScore, { color: myColor }]}>{me.score}</Text>
          <Text style={s.tSep}>|</Text>
          <Text style={[s.tScore, { color: oppColor }]}>{opp.score}</Text>
          <Text style={[s.turnLabel, { color: oppDone ? '#444' : oppColor, textAlign: 'right' }]}>
            J{opponent === 'p1' ? 1 : 2} · RIVAL
          </Text>
          <View style={[s.turnDot, { backgroundColor: oppDone ? '#333' : oppColor }]} />
        </View>

        {/* Rival strip compacto */}
        <View style={[s.oppStrip, { width: contentW }]}>
          <Text style={[s.oppStripLabel, { color: oppColor }]}>RIVAL</Text>
          <View style={s.oppStripDots}>
            {Array.from({ length: MAX_WRONG }).map((_, i) => (
              <View key={i} style={[s.oppDot, { backgroundColor: i < oppWrongs ? RED : '#1e1e1e' }]} />
            ))}
          </View>
          <Text style={s.oppStripStatus}>
            {opp.status === 'won'  ? '¡Adivinó! 🎉'
           : opp.status === 'lost' ? 'Perdió 💀'
           : opp.status === 'waiting' ? 'Conectando…'
           : `${oppWrongs}/${MAX_WRONG} err`}
          </Text>
        </View>

        {/* Gallows completo (mis errores) */}
        <Gallows wrongCount={wrongs} />

        {/* Categoría */}
        <Text style={s.categoryTag}>🐾  ANIMALES</Text>

        {/* Tiles */}
        <View style={[s.wordStrip, { width: contentW }]}>
          {[...(word || '')].map((letter, i) => {
            const hit  = guessed.has(letter);
            const miss = over && !hit;
            return (
              <View key={i} style={[s.tile, { width: tileW, height: tileH }, hit && s.tileHit, miss && s.tileMiss]}>
                <Text style={[s.tileLetter, { fontSize: Math.max(11, tileW * 0.52) }, hit && s.tileLetterHit, miss && s.tileLetterMiss]}>
                  {hit || over ? letter : ''}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Letras falladas */}
        <View style={s.wrongRow}>
          {wrongLetters.length > 0 && (
            <>
              <Text style={s.wrongLabel}>FALLADAS: </Text>
              <Text style={s.wrongLetters}>{wrongLetters.join(' · ')}</Text>
            </>
          )}
        </View>

        {/* Estado al terminar mi ronda */}
        {myDone && (
          <View style={[s.overBadge, { borderColor: won ? GREEN : RED, width: contentW }]}>
            <Text style={s.overEmoji}>{won ? '🎉' : '💀'}</Text>
            <Text style={[s.overTitle, { color: won ? GREEN : RED }]}>
              {won ? '¡ADIVINASTE!' : '¡PERDISTE!'}
            </Text>
          </View>
        )}

        {/* Teclado / espera rival */}
        {!myDone ? (
          <View style={s.kbd}>
            {KEYBOARD_ROWS.map((row, ri) => (
              <View key={ri} style={[s.kbdRow, { gap: KEY_GAP }]}>
                {row.map((letter) => {
                  const used    = guessed.has(letter);
                  const correct = used && word.includes(letter);
                  const wrong   = used && !word.includes(letter);
                  return (
                    <TouchableOpacity
                      key={letter}
                      activeOpacity={0.7}
                      style={[s.key, { width: keyW, height: keyH }, correct && s.keyOk, wrong && s.keyBad]}
                      onPress={() => handleLetter(letter)}
                      disabled={used}
                    >
                      <Text style={[s.keyText, { fontSize: Math.max(10, keyW * 0.38) }, used && s.keyTextUsed, correct && s.keyTextOk]}>
                        {letter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          <View style={[s.waitingRow, { justifyContent: 'center', marginTop: 8 }]}>
            <ActivityIndicator color="#333" size="small" />
            <Text style={s.waitingText}>Esperando al rival…</Text>
          </View>
        )}

      </View>
    </View>
  );

  if (Platform.OS !== 'web') {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={s.gameRoot}>{inner}</View>
      </TouchableWithoutFeedback>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={s.gameRootScroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      {inner}
    </ScrollView>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function OnlineScreen({ onBack }) {
  const [phase, setPhase]   = useState('lobby');
  const [roomId, setRoomId] = useState(null);
  const [player, setPlayer] = useState(null);
  const [word, setWord]     = useState(null);

  function handleGameReady(rid, p, w) {
    setRoomId(rid); setPlayer(p); setWord(w);
    setPhase('game');
  }

  if (phase === 'lobby')  return <LobbyScreen onBack={onBack} onCreate={() => setPhase('create')} onJoin={() => setPhase('join')} />;
  if (phase === 'create') return <CreateRoomScreen onBack={() => setPhase('lobby')} onGameReady={handleGameReady} />;
  if (phase === 'join')   return <JoinRoomScreen onBack={() => setPhase('lobby')} onGameReady={handleGameReady} />;
  if (phase === 'game')   return <OnlineGame roomId={roomId} player={player} initialWord={word} onBack={onBack} />;
  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Screens compartidas
  centered:   { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 14 },

  backWrap:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backArrow:  { color: '#3a3a3a', fontSize: 18 },
  backText:   { color: '#3a3a3a', fontSize: 11, fontWeight: '800', letterSpacing: 3 },

  brandSub:   { color: '#3a3a3a', fontSize: 11, letterSpacing: 5, fontWeight: '700', marginBottom: 4 },
  brandTitle: { fontSize: 40, fontWeight: '900', color: '#f0f0f0', letterSpacing: 8 },
  brandLine:  { width: 64, height: 3, backgroundColor: RED, marginTop: 10, marginBottom: 10 },
  brandTag:   { color: '#363636', fontSize: 12, letterSpacing: 1 },

  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: CARD, borderRadius: 12, padding: 20,
    borderLeftWidth: 3,
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderTopColor: BORDER, borderRightColor: BORDER, borderBottomColor: BORDER,
  },
  modeEmoji: { fontSize: 28 },
  modeTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 3, marginBottom: 2 },
  modeDesc:  { color: '#404040', fontSize: 12 },
  modeChev:  { fontSize: 22, fontWeight: '300' },

  ruleText:     { color: '#2a2a2a', fontSize: 12, letterSpacing: 1, marginTop: 32, lineHeight: 22 },
  sectionTitle: { color: '#3a3a3a', fontSize: 11, fontWeight: '900', letterSpacing: 5 },

  qrBox: {
    backgroundColor: CARD, borderRadius: 16, padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: BORDER,
  },
  roomCode:    { color: '#f0f0f0', fontSize: 32, fontWeight: '900', letterSpacing: 12, marginTop: 16 },
  roomHint:    { color: '#383838', fontSize: 12, marginTop: 8, letterSpacing: 1 },
  waitingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  waitingText: { color: '#383838', fontSize: 12, letterSpacing: 2 },
  errorText:   { color: RED, fontSize: 13, textAlign: 'center', marginTop: 20 },

  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame:   { width: 220, height: 220, borderWidth: 2, borderColor: '#fff', borderRadius: 16 },
  scanHint:    { color: '#fff', marginTop: 16, fontSize: 14, letterSpacing: 2 },
  scanBack:    { position: 'absolute', top: 56, left: 20 },

  codeInput: {
    backgroundColor: CARD, color: '#f0f0f0',
    fontSize: 28, fontWeight: '900', letterSpacing: 10,
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1, borderColor: BORDER, width: '100%', textAlign: 'center',
  },

  replayBtn:  { borderWidth: 1, borderColor: '#303030', paddingVertical: 14, borderRadius: 4, alignItems: 'center' },
  replayText: { color: '#f0f0f0', fontSize: 12, fontWeight: '900', letterSpacing: 6 },

  // Pantalla de juego — igual que offline 2P
  gameRoot:      { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  gameRootScroll:{ flexGrow: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  gameInner:     { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },

  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  gameTitle:  { flex: 1, textAlign: 'center', color: '#1e1e1e', fontSize: 13, fontWeight: '900', letterSpacing: 6 },
  headerMode: { color: '#3a3a3a', fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  // Gallows
  corner: { position: 'absolute', width: 14, height: 14, borderColor: '#222' },
  canvas: { backgroundColor: '#101010', borderRadius: 4, borderWidth: 1, borderColor: '#181818', position: 'relative', overflow: 'hidden' },
  lifeBarBg:   { width: '100%', height: 3, backgroundColor: '#181818', borderRadius: 2, overflow: 'hidden' },
  lifeBarFill: { height: '100%', borderRadius: 2 },
  lifeLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 4, textAlign: 'center' },

  // Turn banner (igual offline 2P)
  turnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14, marginBottom: 8,
  },
  turnDot:   { width: 6, height: 6, borderRadius: 3 },
  turnLabel: { flex: 1, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  tScore:    { fontSize: 11, fontWeight: '800' },
  tSep:      { color: '#2a2a2a', fontSize: 12 },

  // Rival strip compacto
  oppStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 6, paddingHorizontal: 4,
  },
  oppStripLabel:  { fontSize: 9, fontWeight: '900', letterSpacing: 3 },
  oppStripDots:   { flexDirection: 'row', gap: 3 },
  oppDot:         { width: 7, height: 7, borderRadius: 4 },
  oppStripStatus: { color: '#404040', fontSize: 10, letterSpacing: 1 },

  // Tiles
  categoryTag: { color: '#606060', fontSize: 10, letterSpacing: 4, fontWeight: '700', marginVertical: 8 },
  wordStrip:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginBottom: 8 },
  tile:        { backgroundColor: '#101010', borderBottomWidth: 2, borderBottomColor: '#252525', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  tileHit:     { borderBottomColor: '#f0f0f0' },
  tileMiss:    { borderBottomColor: RED },
  tileLetter:  { fontWeight: '900', color: 'transparent' },
  tileLetterHit:  { color: '#f0f0f0' },
  tileLetterMiss: { color: RED },

  wrongRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 6, height: 20 },
  wrongLabel:   { color: '#303030', fontSize: 9, fontWeight: '800', letterSpacing: 3 },
  wrongLetters: { color: '#3a3a3a', fontSize: 11, fontWeight: '700', letterSpacing: 3 },

  // Fin de ronda
  overBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderRadius: 10, paddingVertical: 10, marginBottom: 8,
  },
  overEmoji: { fontSize: 24 },
  overTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 4 },

  // Teclado
  kbd:         { alignItems: 'center', gap: 6, marginTop: 8 },
  kbdRow:      { flexDirection: 'row' },
  key: {
    backgroundColor: CARD, borderRadius: 6,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderTopColor: '#2a2a2a', borderLeftColor: '#222', borderRightColor: '#111',
    borderBottomWidth: 3, borderBottomColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  keyOk:       { backgroundColor: '#0d1f0d', borderTopColor: '#1a3a1a' },
  keyBad:      { backgroundColor: '#160808', borderTopColor: '#2e1010' },
  keyText:     { color: '#505050', fontWeight: '800' },
  keyTextUsed: { color: '#202020' },
  keyTextOk:   { color: GREEN },

  // Pantallas de resultado
  scoreCards: { flexDirection: 'row', gap: 12, marginBottom: 16, width: '100%' },
  scoreCard:  { alignItems: 'center', backgroundColor: CARD, borderRadius: 12, paddingVertical: 16, borderWidth: 1 },
  scNum:      { fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 6 },
  scScore:    { fontSize: 36, fontWeight: '900', color: '#f0f0f0', lineHeight: 38 },
  scSub:      { fontSize: 9, color: '#383838', letterSpacing: 2 },

  roundOverTitle: { color: '#383838', fontSize: 12, fontWeight: '900', letterSpacing: 6, marginBottom: 16 },
  roundResult:    { color: '#505050', fontSize: 13, letterSpacing: 1, marginTop: 12, marginBottom: 8 },
  countdown:      { fontSize: 72, fontWeight: '900', letterSpacing: 4 },
});
