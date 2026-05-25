import { apiPost, apiGet } from './client';

export async function login(email, password) {
  let response;
  try {
    response = await apiPost('/login', { email, password });
  } catch (networkError) {
    throw new Error('Sin conexión al servidor. Verifica tu internet.');
  }

  // Try to read the body as text first to inspect it
  const bodyText = await response.text();

  // If it's HTML, the server returned a page (wrong credentials or redirect issue)
  if (bodyText.trim().startsWith('<')) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    if (!response.ok) {
      throw new Error(`Error del servidor (${response.status})`);
    }
    // 200 with HTML = login page rendered again = bad credentials
    throw new Error('Correo o contraseña incorrectos.');
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`Respuesta inesperada del servidor: ${bodyText.slice(0, 100)}`);
  }

  if (!response.ok || data.status === 'error') {
    throw new Error(data.message || data.error || 'Correo o contraseña incorrectos.');
  }

  if (data.status !== 'success') {
    throw new Error(data.message || 'Error al iniciar sesión.');
  }

  // Fetch user profile using the session cookie set by login
  let me;
  try {
    me = await apiGet('/api/me');
  } catch {
    // If /api/me fails (cookie issue), return basic data from login response
    return { usuario_nombre: data.usuario_nombre || 'Usuario', usuario_rol: data.rol || '2' };
  }

  return me;
}
