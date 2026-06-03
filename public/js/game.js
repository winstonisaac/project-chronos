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
  if (ev.year == null) return '';
  const y = ev.year;
  if (!ev.month) return String(y);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mStr = months[ev.month - 1];
  if (!ev.day) return `${mStr} ${y}`;
  return `${ev.day} ${mStr} ${y}`;
}

export function getImageUrl(ev) {
  // Handle nested format (from JSON files) and flat format (from API/database)
  if (ev.image?.local) return ev.image.local;
  if (ev.image?.url) return ev.image.url;
  if (ev.image_local) return ev.image_local;
  if (ev.image_url) return ev.image_url;
  return '';
}

export function dayNumber(todayStr) {
  const [y, m, day] = todayStr.split('-').map(Number);
  const start = new Date(2024, 0, 1);
  const now = new Date(y, m - 1, day);
  return Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
}
