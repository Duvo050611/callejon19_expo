import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import HangmanScreen from './src/screens/HangmanScreen';
import OnlineScreen from './src/screens/OnlineScreen';

export default function App() {
  const [screen, setScreen] = useState('hangman');

  return (
    <>
      <StatusBar style="light" />
      {screen === 'hangman' && (
        <HangmanScreen onOnline={() => setScreen('online')} />
      )}
      {screen === 'online' && (
        <OnlineScreen onBack={() => setScreen('hangman')} />
      )}
    </>
  );
}
