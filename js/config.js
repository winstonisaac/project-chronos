export const MAX_TRIES = 3;
export const EVENTS_PER_PUZZLE = 7;

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
