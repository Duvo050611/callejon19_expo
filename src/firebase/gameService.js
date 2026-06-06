import {
  doc, setDoc, updateDoc, getDoc,
  onSnapshot, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { randomWord } from '../data/words';

export function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─── Create room (Player 1) ───────────────────────────────────────────────────
export async function createRoom(roomId) {
  const word = randomWord();
  await setDoc(doc(db, 'rooms', roomId), {
    word,
    status: 'waiting',   // waiting | playing | round_over | finished
    round: 1,
    scored: false,
    winner: null,
    nextWord: null,
    createdAt: serverTimestamp(),
    p1: { score: 0, guessed: [], status: 'playing' },
    p2: { score: 0, guessed: [], status: 'waiting' },
  });
  return word;
}

// ─── Join room (Player 2) ─────────────────────────────────────────────────────
export async function joinRoom(roomId) {
  const ref = doc(db, 'rooms', roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Sala no encontrada.');
  const d = snap.data();
  if (d.status !== 'waiting') throw new Error('La sala ya está en juego o no existe.');
  await updateDoc(ref, { status: 'playing', 'p2.status': 'playing' });
  return d.word;
}

// ─── Update my game state on every guess ─────────────────────────────────────
export async function updateMyState(roomId, player, guessed, status) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`${player}.guessed`]: [...guessed],
    [`${player}.status`]: status,   // 'playing' | 'won' | 'lost'
  });
}

// ─── Score round (transactional — both clients can call, only one runs) ───────
export async function processRoundEnd(roomId) {
  const ref = doc(db, 'rooms', roomId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const d = snap.data();

    // Guards
    if (d.scored) return;
    if (d.p1.status === 'playing' || d.p2.status === 'playing') return;
    if (d.p2.status === 'waiting') return;

    const p1Won    = d.p1.status === 'won';
    const p2Won    = d.p2.status === 'won';
    const bothLost = d.p1.status === 'lost' && d.p2.status === 'lost';

    let p1s = d.p1.score + (p1Won ? 1 : bothLost ? 1 : 0);
    let p2s = d.p2.score + (p2Won ? 1 : bothLost ? 1 : 0);

    const gameOver = p1s >= 5 || p2s >= 5;
    const winner   = p1s >= 5 && p2s >= 5
      ? 'draw' : p1s >= 5 ? 'p1' : p2s >= 5 ? 'p2' : null;

    tx.update(ref, {
      scored: true,
      'p1.score': p1s,
      'p2.score': p2s,
      ...(gameOver
        ? { status: 'finished', winner }
        : { status: 'round_over', nextWord: randomWord(), round: d.round + 1 }),
    });
  });
}

// ─── Advance to next round (called by P1 after countdown) ────────────────────
export async function startNextRound(roomId) {
  const ref = doc(db, 'rooms', roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  if (d.status !== 'round_over') return;

  await updateDoc(ref, {
    word: d.nextWord,
    status: 'playing',
    scored: false,
    nextWord: null,
    'p1.guessed': [],
    'p1.status': 'playing',
    'p2.guessed': [],
    'p2.status': 'playing',
  });
}

// ─── Real-time listener ───────────────────────────────────────────────────────
export function subscribeToRoom(roomId, callback) {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}
