import { getManilaDateStr } from './config.js';
import { getAuthToken } from './auth.js';

export async function fetchToday() {
  const headers = {};
  const token = await getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/today', { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load puzzle (${res.status})`);
  }
  return res.json();
}

export async function submitAnswer(order, tryNumber) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/submit', {
    method: 'POST',
    headers,
    body: JSON.stringify({ order, tryNumber })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to submit (${res.status})`);
  }
  return res.json();
}

export async function fetchStats() {
  const token = await getAuthToken();
  if (!token) return null;

  const res = await fetch('/api/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load stats (${res.status})`);
  }
  return res.json();
}
