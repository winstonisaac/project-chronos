// Philippine timezone helpers
// Manila is UTC+8 and does not observe DST

export function getManilaDateStr(date = new Date()) {
  const manila = date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [m, d, y] = manila.split('/');
  return `${y}-${m}-${d}`;
}

export function getManilaNow() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
  );
}

export function getTomorrowManilaStr() {
  const now = getManilaNow();
  now.setDate(now.getDate() + 1);
  return getManilaDateStr(now);
}

export function subtractDaysManila(days) {
  const now = getManilaNow();
  now.setDate(now.getDate() - days);
  return getManilaDateStr(now);
}
