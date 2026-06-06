import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD5jgDiOOKbOoGKX8SOHCdnJ2OirUD_k10',
  authDomain: 'ahorcado-4bd0c.firebaseapp.com',
  projectId: 'ahorcado-4bd0c',
  storageBucket: 'ahorcado-4bd0c.firebasestorage.app',
  messagingSenderId: '260979710362',
  appId: '1:260979710362:web:1068ce869791f419364223',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
