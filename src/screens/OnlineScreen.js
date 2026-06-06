import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
const WIN_SCORE  = 5;
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
  const contentW = Math.min(width - 28, 520);
  const keyW     = Math.max(22, Math.floor((contentW - KEY_GAP * (ROW1 - 1)) / ROW1));
  const keyH     = Math.min(44, keyW + 10);
  return { width, height, contentW, keyW, keyH };
}

// ─── Mini hangman (opponent view) ────────────────────────────────────────────
function MiniHangman({ wrongCount }) {
  const bar = (l, t, w, h) => (
    <View style={{ position: 'absolute', backgroundColor: '#555', left: l, top: t, width: w, height: h }} />
  );
  const sc = 0.45;
  return (
    <View style={{ width: 96 * sc, height: 90 * sc, position: 'relative' }}>
      {bar(4*sc, 82*sc, 36*sc, 1.5)}
      {bar(20*sc, 4*sc, 1.5, 78*sc)}
      {bar(20*sc, 4*sc, 44*sc, 1.5)}
      {bar(62*sc, 4*sc, 1.5, 16*sc)}
      {wrongCount >= 1 && (
        <View style={{
          position: 'absolute', left: 53*sc, top: 20*sc,
          width: 11*sc, height: 11*sc, borderRadius: 6*sc,
          borderWidth: 1.5, borderColor: '#888',
        }} />
      )}
      {wrongCount >= 2 && bar(62*sc, 31*sc, 1.5, 20*sc)}
      {wrongCount >= 3 && (
        <View style={{ position:'absolute', left:50*sc, top:36*sc, width:16*sc, height:1.5, backgroundColor:'#888', transform:[{rotate:'135deg'}] }} />
      )}
      {wrongCount >= 4 && (
        <View style={{ position:'absolute', left:64*sc, top:36*sc, width:16*sc, height:1.5, backgroundColor:'#888', transform:[{rotate:'45deg'}] }} />
      )}
      {wrongCount >= 5 && (
        <View style={{ position:'absolute', left:48*sc, top:55*sc, width:20*sc, height:1.5, backgroundColor:'#888', transform:[{rotate:'127deg'}] }} />
      )}
      {wrongCount >= 6 && (
        <View style={{ position:'absolute', left:64*sc, top:55*sc, width:20*sc, height:1.5, backgroundColor:'#888', transform:[{rotate:'53deg'}] }} />
      )}
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
  const [roomId]   = useState(generateRoomId);
  const [status, setStatus] = useState('creating'); // creating | waiting | error
  const unsubRef = useRef(null);

  useEffect(() => {
    createRoom(roomId)
      .then(() => {
        setStatus('waiting');
        unsubRef.current = subscribeToRoom(roomId, (data) => {
          if (data.status === 'playing') {
            unsubRef.current?.();
            onGameReady(roomId, 'p1', data.word);
          }
        });
      })
      .catch(() => setStatus('error'));

    return () => unsubRef.current?.();
  }, []);

  return (
    <View style={s.centered}>
      <View style={{ width: contentW, alignItems: 'center' }}>
        <TouchableOpacity onPress={onBack} style={[s.backWrap, { alignSelf: 'flex-start' }]}>
          <Text style={s.backText}>← ATRÁS</Text>
        </TouchableOpacity>

        <Text style={[s.sectionTitle, { marginTop: 24 }]}>TU SALA</Text>

        {status === 'creating' && <ActivityIndicator color={P1} style={{ marginTop: 40 }} />}

        {status === 'waiting' && (
          <>
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
              <ActivityIndicator color={P1} size="small" />
              <Text style={s.waitingText}>Esperando al rival…</Text>
            </View>
          </>
        )}

        {status === 'error' && (
          <Text style={s.errorText}>Error al crear la sala. Intenta de nuevo.</Text>
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
  const { contentW, keyW, keyH } = useSizes();
  const opponent = player === 'p1' ? 'p2' : 'p1';

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

  // Detect round end
  useEffect(() => {
    if (!room) return;
    if (room.status !== 'playing') return;
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

    const word    = room.word;
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
  if (room.status === 'round_over' && countdown !== null) {
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
          <Text style={[s.countdown, { color: AMBER }]}>{countdown}</Text>
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
  const word      = room.word || initialWord;
  const me        = room[player]  || { score: 0, guessed: [], status: 'playing' };
  const opp       = room[opponent]|| { score: 0, guessed: [], status: 'playing' };
  const myDone    = me.status !== 'playing';
  const wrongs    = [...guessed].filter((l) => !word.includes(l)).length;
  const won       = me.status === 'won' || (word && [...word].every((l) => guessed.has(l)));
  const lost      = me.status === 'lost' || wrongs >= MAX_WRONG;
  const pct       = (MAX_WRONG - wrongs) / MAX_WRONG;
  const barColor  = pct > 0.6 ? GREEN : pct > 0.3 ? AMBER : RED;

  const oppGuessed = new Set(opp.guessed || []);
  const oppWrongs  = opp.guessed ? opp.guessed.filter((l) => !word.includes(l)).length : 0;
  const oppPct     = (MAX_WRONG - oppWrongs) / MAX_WRONG;
  const oppBarColor = oppPct > 0.6 ? GREEN : oppPct > 0.3 ? AMBER : RED;

  return (
    <ScrollView
      contentContainerStyle={[s.gameRoot, { paddingHorizontal: 14 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: contentW, alignItems: 'center' }}>

        {/* Header */}
        <View style={[s.header, { width: contentW }]}>
          <TouchableOpacity onPress={onBack} style={s.backWrap}>
            <Text style={s.backText}>← SALIR</Text>
          </TouchableOpacity>
          <Text style={s.gameTitle}>RONDA {room.round}</Text>
          <Text style={s.headerMode}>ONLINE</Text>
        </View>

        {/* Scores */}
        <View style={[s.onlineScores, { width: contentW }]}>
          <View style={s.onlineScoreChip}>
            <Text style={[s.osLabel, { color: player==='p1'?P1:P2 }]}>
              TÚ (J{player==='p1'?1:2})
            </Text>
            <Text style={s.osNum}>{me.score}</Text>
            <Text style={s.osOf}>/ {WIN_SCORE}</Text>
          </View>
          <View style={s.osDivider} />
          <View style={s.onlineScoreChip}>
            <Text style={[s.osLabel, { color: opponent==='p1'?P1:P2 }]}>
              RIVAL (J{opponent==='p1'?1:2})
            </Text>
            <Text style={s.osNum}>{opp.score}</Text>
            <Text style={s.osOf}>/ {WIN_SCORE}</Text>
          </View>
        </View>

        {/* My life bar */}
        <View style={{ width: contentW, marginBottom: 4 }}>
          <View style={s.lifeBarBg}>
            <View style={[s.lifeBarFill, { width: `${pct*100}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={[s.lifeLabel, { color: barColor }]}>
            {MAX_WRONG - wrongs} / {MAX_WRONG} VIDAS
          </Text>
        </View>

        {/* Word tiles */}
        <Text style={s.categoryTag}>🐾  ANIMALES</Text>
        <View style={[s.wordStrip, { width: contentW }]}>
          {[...(word || '')].map((letter, i) => {
            const hit  = guessed.has(letter);
            const miss = lost && !hit;
            return (
              <View key={i} style={[s.tile, hit && s.tileHit, miss && s.tileMiss]}>
                <Text style={[s.tileLetter, hit && s.tileLetterHit, miss && s.tileLetterMiss]}>
                  {hit || lost ? letter : ''}
                </Text>
              </View>
            );
          })}
        </View>

        {/* My status */}
        {myDone && (
          <Text style={[s.myStatus, { color: won ? GREEN : RED }]}>
            {won ? '¡Adivinaste! 🎉' : '¡Perdiste esta ronda! 💀'}
          </Text>
        )}

        {/* Opponent mini view */}
        <View style={[s.oppBox, { width: contentW }]}>
          <MiniHangman wrongCount={oppWrongs} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[s.oppLabel, { color: opponent==='p1'?P1:P2 }]}>
              RIVAL · J{opponent==='p1'?1:2}
            </Text>
            <View style={s.lifeBarBg}>
              <View style={[s.lifeBarFill, { width: `${oppPct*100}%`, backgroundColor: oppBarColor }]} />
            </View>
            <Text style={s.oppStatus}>
              {opp.status === 'waiting' ? 'Conectando…'
                : opp.status === 'won'  ? '¡Adivinó! 🎉'
                : opp.status === 'lost' ? 'Perdió 💀'
                : `Letras: ${opp.guessed?.filter(l => word.includes(l)).length ?? 0} · Errores: ${oppWrongs}`}
            </Text>
          </View>
        </View>

        {/* Wrong letters */}
        {[...guessed].filter(l => !word.includes(l)).length > 0 && (
          <View style={s.wrongRow}>
            <Text style={s.wrongLabel}>FALLADAS: </Text>
            <Text style={s.wrongLetters}>
              {[...guessed].filter(l => !word.includes(l)).join(' · ')}
            </Text>
          </View>
        )}

        {/* Keyboard */}
        {!myDone && (
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
        )}

        {myDone && (
          <View style={[s.waitingOpponent, { width: contentW }]}>
            <ActivityIndicator color="#333" size="small" />
            <Text style={s.waitingText}>Esperando al rival…</Text>
          </View>
        )}

      </View>
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
  centered:   { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 14 },
  gameRoot:   { flexGrow: 1, backgroundColor: BG, alignItems: 'center', paddingTop: 50, paddingBottom: 40 },

  backWrap:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
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

  ruleText: { color: '#2a2a2a', fontSize: 12, letterSpacing: 1, marginTop: 32, lineHeight: 22 },

  sectionTitle: { color: '#3a3a3a', fontSize: 11, fontWeight: '900', letterSpacing: 5 },

  qrBox: {
    backgroundColor: CARD, borderRadius: 16,
    padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: BORDER,
  },
  roomCode: {
    color: '#f0f0f0', fontSize: 32, fontWeight: '900',
    letterSpacing: 12, marginTop: 16,
  },
  roomHint: { color: '#383838', fontSize: 12, marginTop: 8, letterSpacing: 1 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  waitingText: { color: '#383838', fontSize: 12, letterSpacing: 2 },
  errorText: { color: RED, fontSize: 14, textAlign: 'center', marginTop: 20 },

  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  scanFrame: {
    width: 220, height: 220,
    borderWidth: 2, borderColor: '#fff',
    borderRadius: 16,
  },
  scanHint: { color: '#fff', marginTop: 16, fontSize: 14, letterSpacing: 2 },
  scanBack: { position: 'absolute', top: 56, left: 20 },

  codeInput: {
    backgroundColor: CARD, color: '#f0f0f0',
    fontSize: 28, fontWeight: '900', letterSpacing: 10,
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1, borderColor: BORDER, width: '100%', textAlign: 'center',
  },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  gameTitle: { flex: 1, textAlign: 'center', color: '#1e1e1e', fontSize: 12, fontWeight: '900', letterSpacing: 6 },
  headerMode: { color: '#3a3a3a', fontSize: 11, fontWeight: '800', letterSpacing: 3 },

  onlineScores: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: BORDER, marginBottom: 12,
  },
  onlineScoreChip: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  osLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  osNum:   { color: '#f0f0f0', fontSize: 24, fontWeight: '900' },
  osOf:    { color: '#383838', fontSize: 12 },
  osDivider: { width: 1, height: 30, backgroundColor: BORDER, marginHorizontal: 10 },

  lifeBarBg: { height: 3, backgroundColor: '#181818', borderRadius: 2, overflow: 'hidden' },
  lifeBarFill: { height: '100%', borderRadius: 2 },
  lifeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 3 },

  categoryTag: { color: '#606060', fontSize: 10, letterSpacing: 4, fontWeight: '700', marginVertical: 8 },

  wordStrip: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginBottom: 8 },
  tile: { width: 30, height: 36, backgroundColor: '#101010', borderBottomWidth: 2, borderBottomColor: '#252525', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  tileHit:  { borderBottomColor: '#f0f0f0' },
  tileMiss: { borderBottomColor: RED },
  tileLetter: { fontSize: 17, fontWeight: '900', color: 'transparent' },
  tileLetterHit:  { color: '#f0f0f0' },
  tileLetterMiss: { color: RED },

  myStatus: { fontSize: 16, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },

  oppBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },
  oppLabel:  { color: '#505050', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  oppStatus: { color: '#383838', fontSize: 11, letterSpacing: 1 },

  wrongRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  wrongLabel: { color: '#303030', fontSize: 9, fontWeight: '800', letterSpacing: 3 },
  wrongLetters: { color: '#3a3a3a', fontSize: 11, fontWeight: '700', letterSpacing: 3 },

  kbd: { alignItems: 'center', gap: 6, marginTop: 10 },
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
  keyTextOk:   { color: GREEN },

  waitingOpponent: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, justifyContent: 'center' },

  overEmoji: { fontSize: 52, marginBottom: 8 },
  overTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 6, marginBottom: 20 },
  scoreCards: { flexDirection: 'row', gap: 12, marginBottom: 16, width: '100%' },
  scoreCard: {
    alignItems: 'center', backgroundColor: CARD,
    borderRadius: 12, paddingVertical: 16, borderWidth: 1,
  },
  scNum: { fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 6 },
  scScore: { fontSize: 36, fontWeight: '900', color: '#f0f0f0', lineHeight: 38 },
  scSub: { fontSize: 9, color: '#383838', letterSpacing: 2 },

  roundOverTitle: { color: '#383838', fontSize: 12, fontWeight: '900', letterSpacing: 6, marginBottom: 16 },
  roundResult: { color: '#505050', fontSize: 13, letterSpacing: 1, marginTop: 12, marginBottom: 8 },
  countdown: { fontSize: 72, fontWeight: '900', letterSpacing: 4 },

  replayBtn: { borderWidth: 1, borderColor: '#303030', paddingVertical: 14, borderRadius: 4, alignItems: 'center' },
  replayText: { color: '#f0f0f0', fontSize: 12, fontWeight: '900', letterSpacing: 6 },
});
