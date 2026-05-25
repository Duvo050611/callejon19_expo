import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import { setAuthToken } from './src/api/client';

const ROLES = { '1': 'Admin', '2': 'Mesero', '3': 'Cocina', '4': 'Inventario' };

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((stored) => {
        if (stored) {
          const userData = JSON.parse(stored);
          if (userData.socket_token) setAuthToken(userData.socket_token);
          setUser(userData);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLoginSuccess(userData) {
    if (userData.socket_token) setAuthToken(userData.socket_token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }

  async function handleLogout() {
    await AsyncStorage.removeItem('user');
    setUser(null);
  }

  if (loading) return null;

  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.welcome}>Bienvenido,</Text>
      <Text style={styles.name}>{user.nombre || 'Usuario'}</Text>
      <Text style={styles.role}>{ROLES[String(user.rol)] || 'Sin rol'}</Text>
      <Text style={styles.logout} onPress={handleLogout}>Cerrar sesión</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: {
    color: '#aaa',
    fontSize: 18,
  },
  name: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  role: {
    color: '#e63946',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 40,
  },
  logout: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
