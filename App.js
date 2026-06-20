import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen      from './src/screens/HomeScreen';
import HangmanScreen   from './src/screens/HangmanScreen';
import OnlineScreen    from './src/screens/OnlineScreen';
import HydrationScreen from './src/screens/HydrationScreen';

export default function App() {
  const [screen, setScreen] = useState('home');

  return (
    <>
      <StatusBar style="light" />
      {screen === 'home'      && <HomeScreen      onHangman={() => setScreen('hangman')} onHydration={() => setScreen('hydration')} />}
      {screen === 'hangman'   && <HangmanScreen   onOnline={() => setScreen('online')} onBack={() => setScreen('home')} />}
      {screen === 'online'    && <OnlineScreen    onBack={() => setScreen('hangman')} />}
      {screen === 'hydration' && <HydrationScreen onBack={() => setScreen('home')} />}
    </>
  );
}
