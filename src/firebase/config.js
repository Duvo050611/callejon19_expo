import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, memoryLocalCache } from 'firebase/firestore';

const firebaseConfig = {
      apiKey: "AIzaSyD5jgDiOOKbOoGKX8SOHCdnJ2OirUD_k10",
      authDomain: "ahorcado-4bd0c.firebaseapp.com",
      projectId: "ahorcado-4bd0c",
      storageBucket: "ahorcado-4bd0c.firebasestorage.app",
      messagingSenderId: "260979710362",
      appId: "1:260979710362:web:1068ce869791f419364223",
      measurementId: "G-2CR9MYVZ3N"
};
// getApps() evita doble inicialización en HMR (hot reload de Expo web)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// experimentalForceLongPolling solo en nativo — en web usa WebSocket nativo del browser
const settings = {
  localCache: memoryLocalCache(),
  ...(Platform.OS !== 'web' && { experimentalForceLongPolling: true }),
};

export const db = (() => {
  try {
    return initializeFirestore(app, settings);
  } catch {
    // initializeFirestore lanza si se llama dos veces (puede pasar en HMR)
    return getFirestore(app);
  }
})();
