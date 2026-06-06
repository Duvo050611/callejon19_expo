import { initializeApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD5jgDiOOKbOoGKX8SOHCdnJ2OirUD_k10',
  authDomain: 'ahorcado-4bd0c.firebaseapp.com',
  projectId: 'ahorcado-4bd0c',
  storageBucket: 'ahorcado-4bd0c.firebasestorage.app',
  messagingSenderId: '260979710362',
  appId: '1:260979710362:web:1068ce869791f419364223',
};

const app = initializeApp(firebaseConfig);

// memoryLocalCache: deshabilita la persistencia offline.
// Sin esto el SDK encola escrituras indefinidamente cuando no puede
// conectar a los servidores de Firebase (promesa nunca resuelve/rechaza).
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
});
