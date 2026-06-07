import { getManilaDateStr } from './config.js';

const STATS_KEY = 'chronos_stats_v2';

export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, lastPlayed: null, lastCompleted: null };
    return JSON.parse(raw);
  } catch (e) {
    return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, lastPlayed: null, lastCompleted: null };
  }
}

export function saveStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) {}
}

export function updateStats(won, todayStr) {
  const s = loadStats();
  if (s.lastPlayed === todayStr) return s;
  s.lastPlayed = todayStr;
  s.played += 1;
  if (won) {
    s.won += 1;
    const yesterday = getYesterdayStr(todayStr);
    if (s.lastCompleted === yesterday) {
      s.currentStreak += 1;
    } else {
      s.currentStreak = 1;
    }
    s.lastCompleted = todayStr;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  } else {
    s.currentStreak = 0;
  }
  saveStats(s);
  return s;
}

function getYesterdayStr(todayStr) {
  const [y, m, day] = todayStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() - 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function loadDayState(todayStr) {
  try {
    const raw = localStorage.getItem('chronos_day_' + todayStr);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function saveDayState(todayStr, state) {
  try { localStorage.setItem('chronos_day_' + todayStr, JSON.stringify(state)); } catch (e) {}
}

export async function syncStatsToServer(supabase, userId) {
  if (!supabase || !userId) return;
  const localStats = loadStats();
  try {
    const { data: existing } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    const serverStats = existing || {
      games_played: 0,
      games_won: 0,
      current_streak: 0,
      max_streak: 0,
      last_completed: null,
      last_played: null
    };

    // Merge: take the higher values
    const merged = {
      user_id: userId,
      games_played: Math.max(serverStats.games_played || 0, localStats.played || 0),
      games_won: Math.max(serverStats.games_won || 0, localStats.won || 0),
      current_streak: Math.max(serverStats.current_streak || 0, localStats.currentStreak || 0),
      max_streak: Math.max(serverStats.max_streak || 0, localStats.maxStreak || 0),
      last_completed: localStats.lastCompleted || serverStats.last_completed || null,
      last_played: localStats.lastPlayed || serverStats.last_played || null,
      updated_at: new Date().toISOString()
    };

    await supabase.from('user_stats').upsert(merged);
    return true;
  } catch (e) {
    console.error('Failed to sync stats:', e);
    return false;
  }
}
