import { db } from './config';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
} from 'firebase/firestore';
import { randomWord } from '../data/words';

export function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export async function createRoom(roomId) {
  const word = randomWord();
  await setDoc(doc(db, 'rooms', roomId), {
    word,
    status: 'waiting',
    round: 1,
    scored: false,
    winner: null,
    nextWord: null,
    p1: { score: 0, guessed: [], status: 'playing' },
    p2: { score: 0, guessed: [], status: 'waiting' },
  });
  return word;
}

export async function joinRoom(roomId) {
  const ref = doc(db, 'rooms', roomId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      if (d.status !== 'waiting') throw new Error('La sala ya está en juego o no existe.');
      await updateDoc(ref, { status: 'playing', 'p2.status': 'playing' });
      return d.word;
    }
    if (attempt < 4) await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error('Sala no encontrada. Verifica el código.');
}

export async function updateMyState(roomId, player, guessed, status) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`${player}.guessed`]: guessed,
    [`${player}.status`]: status,
  });
}

// Solo lo llama P1 — evita condición de carrera sin necesitar transacción
export async function processRoundEnd(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.scored) return;
  if (data.p1.status === 'playing' || data.p2.status === 'playing') return;
  if (data.p2.status === 'waiting') return;

  const p1Won    = data.p1.status === 'won';
  const p2Won    = data.p2.status === 'won';
  const bothLost = data.p1.status === 'lost' && data.p2.status === 'lost';

  const p1s = data.p1.score + (p1Won || bothLost ? 1 : 0);
  const p2s = data.p2.score + (p2Won || bothLost ? 1 : 0);

  const gameOver = p1s >= 5 || p2s >= 5;
  const winner   = p1s >= 5 && p2s >= 5 ? 'draw' : p1s >= 5 ? 'p1' : p2s >= 5 ? 'p2' : null;

  await updateDoc(doc(db, 'rooms', roomId), {
    scored: true,
    'p1.score': p1s,
    'p2.score': p2s,
    ...(gameOver
      ? { status: 'finished', winner }
      : { status: 'round_over', nextWord: randomWord(), round: data.round + 1 }),
  });
}

export async function startNextRound(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  if (!snap.exists() || snap.data().status !== 'round_over') return;
  const { nextWord } = snap.data();
  await updateDoc(doc(db, 'rooms', roomId), {
    word: nextWord,
    status: 'playing',
    scored: false,
    nextWord: null,
    'p1.guessed': [],
    'p1.status':  'playing',
    'p2.guessed': [],
    'p2.status':  'playing',
  });
}

export function subscribeToRoom(roomId, callback) {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}
