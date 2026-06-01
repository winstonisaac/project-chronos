export function compareEvents(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  const ma = a.month || 1;
  const mb = b.month || 1;
  if (ma !== mb) return ma - mb;
  return (a.day || 1) - (b.day || 1);
}

export function fmtYear(y) {
  if (y < 0) return `${Math.abs(y)} BCE`;
  return `${y} CE`;
}

export function fmtDate(ev) {
  const y = ev.year;
  const yearStr = y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
  if (!ev.month) return yearStr;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mStr = months[ev.month - 1];
  if (!ev.day) return `${mStr} ${yearStr}`;
  return `${ev.day} ${mStr} ${yearStr}`;
}

export function getImageUrl(ev) {
  if (!ev.image) return '';
  if (ev.image.local) return ev.image.local;
  return ev.image.url || '';
}

export function dayNumber(todayStr) {
  const [y, m, day] = todayStr.split('-').map(Number);
  const start = new Date(2024, 0, 1);
  const now = new Date(y, m - 1, day);
  return Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
}
