const BASE_URL = 'https://restaurante-callejon-9-production.up.railway.app';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export async function apiPost(path, body, token) {
  const t = token ?? authToken;
  const headers = { 'Content-Type': 'application/json' };
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });
  return response;
}

export async function apiGet(path, token) {
  const t = token ?? authToken;
  const headers = { 'Content-Type': 'application/json' };
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  return response.json();
}
