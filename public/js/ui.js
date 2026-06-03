import { MAX_TRIES, EVENTS_PER_PUZZLE } from './config.js';
import { fmtDate, getImageUrl } from './game.js';

// DOM element references
export const listEl = document.getElementById('event-list');

// Store current rendered items for re-render (e.g., reading mode toggle)
let currentItems = [];
export const submitBtn = document.getElementById('submit-btn');
export const triesVal = document.getElementById('tries-val');
export const triesPill = document.getElementById('tries-pill');
export const overlay = document.getElementById('result-overlay');
export const resultEmoji = document.getElementById('result-emoji');
export const resultTitle = document.getElementById('result-title');
export const resultMessage = document.getElementById('result-message');
export const countdownEl = document.getElementById('countdown');
export const shareBtn = document.getElementById('share-btn');
export const closeModalBtn = document.getElementById('close-modal-btn');
export const streakVal = document.getElementById('streak-val');
export const bestVal = document.getElementById('best-val');
export const dateDisplay = document.getElementById('date-display');
export const instructionCard = document.getElementById('instruction-card');
export const errorToast = document.getElementById('error-toast');
export const authSection = document.getElementById('auth-section');

// Reading mode state
let readingMode = false;

// Locked items tracking
let lockedPositions = new Set();
let answerOrderIds = [];

export function isReadingMode() {
  return readingMode;
}

export function setAnswerOrder(orderIds) {
  answerOrderIds = orderIds || [];
}

export function setReadingMode(enabled) {
  readingMode = enabled;
  const children = Array.from(listEl.children);
  const lockedIndices = new Set();
  children.forEach((li, i) => {
    if (li.classList.contains('locked')) lockedIndices.add(i);
  });
  // Preserve current user sort order
  const itemMap = new Map(currentItems.map(e => [e.id, e]));
  const orderedItems = children.map(li => itemMap.get(li.dataset.id)).filter(Boolean);
  renderList(orderedItems, lockedIndices, false, lockedIndices);
  initSortable(clearMarks);
}

// Lightbox elements
const imageLightbox = document.getElementById('image-lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');

function openLightbox(imgUrl, caption) {
  if (!imgUrl) return;
  lightboxImg.src = imgUrl;
  lightboxCaption.textContent = caption || '';
  imageLightbox.classList.add('show');
  imageLightbox.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  imageLightbox.classList.remove('show');
  imageLightbox.setAttribute('aria-hidden', 'true');
  lightboxImg.src = '';
}

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (imageLightbox) {
  imageLightbox.querySelector('.overlay-bg')?.addEventListener('click', closeLightbox);
}

export let sortable = null;

export function renderList(items, markedIndices = new Set(), revealSources = false, lockedIndices = new Set()) {
  currentItems = items;
  listEl.innerHTML = '';
  items.forEach((ev, idx) => {
    const li = document.createElement('li');
    li.className = 'event-item';
    if (markedIndices.has(idx)) li.classList.add('correct');
    if (lockedIndices.has(idx)) li.classList.add('locked');
    li.dataset.date = fmtDate(ev);
    li.dataset.id = ev.id;

    const thumbLetter = ev.text ? ev.text.charAt(0).toUpperCase() : '?';
    const imgUrl = getImageUrl(ev);
    const thumbHtml = imgUrl
      ? `<img src="${imgUrl}" alt="" data-img-url="${imgUrl}" data-caption="${ev.text.replace(/"/g, '&quot;')}" onerror="this.parentElement.textContent='${thumbLetter}'">`
      : thumbLetter;

    let sourceText = ev.source?.text || ev.source_text || '';
    const sourceUrl = ev.source?.url || ev.source_url || '';
    // Redact parenthetical content in reading mode
    if (readingMode && sourceText) {
      sourceText = sourceText.replace(/\([^)]*\)/g, '(■■■■)');
    }
    const showSource = revealSources || readingMode;
    const sourceVisible = showSource && sourceText ? 'visible' : '';
    const sourceHtml = sourceText
      ? `<a class="event-source ${sourceVisible}" href="${sourceUrl || '#'}" target="_blank" rel="noopener">${sourceText}</a>`
      : '';

    li.innerHTML = `
      <div class="check-mark">✓</div>
      <div class="event-thumb">${thumbHtml}</div>
      <div class="event-info">
        <div class="event-text">${ev.text}</div>
        ${sourceHtml}
      </div>
      <div class="event-year">${fmtDate(ev)}</div>
      <div class="drag-handle">⋮⋮</div>
    `;
    listEl.appendChild(li);
  });
}

export function initSortable(onStart) {
  if (sortable) sortable.destroy();
  const hasLocks = lockedPositions.size > 0;
  sortable = new Sortable(listEl, {
    animation: hasLocks ? 0 : 180,
    draggable: '.event-item:not(.locked)',
    handle: '.event-item',
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    easing: 'cubic-bezier(1, 0, 0, 1)',
    onStart,
    onEnd: function () {
      setTimeout(snapLockedItems, 0);
    }
  });
}

// Click-to-enlarge images
listEl.addEventListener('click', (e) => {
  const img = e.target.closest('.event-thumb img');
  if (!img) return;
  const url = img.dataset.imgUrl;
  const caption = img.dataset.caption;
  if (url) openLightbox(url, caption);
});

export function clearMarks() {
  Array.from(listEl.children).forEach(li => {
    if (!li.classList.contains('locked')) {
      li.classList.remove('correct', 'wrong');
    }
  });
}

export function getUserOrder() {
  return Array.from(listEl.children).map(li => li.dataset.id);
}

function snapLockedItems() {
  if (lockedPositions.size === 0 || answerOrderIds.length !== EVENTS_PER_PUZZLE) return;

  // Build desired order: locked items at their correct slots,
  // unlocked items keep their current relative order filling gaps
  const currentIds = Array.from(listEl.children).map(li => li.dataset.id);
  const desiredOrder = new Array(EVENTS_PER_PUZZLE);
  const usedLockedIds = new Set();

  lockedPositions.forEach(pos => {
    const correctId = answerOrderIds[pos];
    desiredOrder[pos] = correctId;
    usedLockedIds.add(correctId);
  });

  const remainingIds = currentIds.filter(id => !usedLockedIds.has(id));
  let remIdx = 0;
  for (let i = 0; i < EVENTS_PER_PUZZLE; i++) {
    if (!lockedPositions.has(i)) {
      desiredOrder[i] = remainingIds[remIdx++];
    }
  }

  // Surgical reorder: appendChild each node in desired sequence
  // (appendChild on existing child moves it to end, preserving all state)
  const nodeMap = new Map(Array.from(listEl.children).map(li => [li.dataset.id, li]));
  desiredOrder.forEach(id => {
    const node = nodeMap.get(id);
    if (node) listEl.appendChild(node);
  });
}

export function evaluateAndMark(correctPositions) {
  lockedPositions = new Set(correctPositions);
  const children = Array.from(listEl.children);
  children.forEach((li, i) => {
    li.classList.remove('correct', 'wrong', 'locked');
    if (correctPositions.includes(i)) {
      li.classList.add('correct', 'locked');
    } else {
      li.classList.add('wrong');
    }
  });
  // Re-init Sortable only once — snapLockedItems in onEnd handles the rest
  initSortable(clearMarks);
}

export function revealAll(eventsWithDates) {
  const dateMap = eventsWithDates ? new Map(eventsWithDates.map(e => [e.id, e])) : null;
  Array.from(listEl.children).forEach(li => {
    li.classList.remove('wrong');
    li.classList.add('correct');
    const yearEl = li.querySelector('.event-year');
    if (dateMap) {
      const ev = dateMap.get(li.dataset.id);
      if (ev) yearEl.textContent = fmtDate(ev);
    }
    yearEl.classList.add('revealed');
    const sourceEl = li.querySelector('.event-source');
    if (sourceEl) sourceEl.classList.add('visible');
  });
}

export function finalizeLossState(userOrderIds, answerOrderIds, puzzleEvents) {
  const eventMap = new Map(puzzleEvents.map(e => [e.id, e]));
  const answerEvents = answerOrderIds.map(id => eventMap.get(id)).filter(Boolean);

  const correctIndices = new Set();
  userOrderIds.forEach((id, i) => {
    if (id === answerOrderIds[i]) correctIndices.add(i);
  });

  renderList(answerEvents, correctIndices, true);

  Array.from(listEl.children).forEach((li, i) => {
    const yearEl = li.querySelector('.event-year');
    yearEl.classList.add('revealed');
    if (!correctIndices.has(i)) {
      li.classList.add('wrong');
    }
    const sourceEl = li.querySelector('.event-source');
    if (sourceEl) sourceEl.classList.add('visible');
  });
}

export function updateTriesUI(triesUsed) {
  const left = Math.max(0, MAX_TRIES - triesUsed);
  triesVal.textContent = left;
  if (left === 0) {
    triesPill.innerHTML = 'No tries left';
  } else if (left === 1) {
    triesPill.innerHTML = 'Tries left: <span class="num">1</span>';
  } else {
    triesPill.innerHTML = `Tries left: <span class="num">${left}</span>`;
  }
}

export function showOverlay(won, triesUsed, stats, answerEvents) {
  if (won) {
    resultEmoji.textContent = '🎉';
    resultTitle.textContent = 'Correct!';
    resultMessage.textContent = `Solved in ${triesUsed}/${MAX_TRIES} tries.\nStreak: ${stats.currentStreak} day${stats.currentStreak===1?'':'s'} · Best: ${stats.maxStreak}`;
  } else {
    resultEmoji.textContent = '💥';
    resultTitle.textContent = 'Out of tries';
    const names = answerEvents.map(e => `${e.text} (${fmtDate(e)})`).join('\n');
    resultMessage.innerHTML = `<strong>Correct order:</strong><br><pre style="margin:8px 0 0;font-family:inherit;white-space:pre-wrap;color:var(--muted)">${names}</pre>`;
  }
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  startCountdown();
}

export function startCountdown() {
  function tick() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const diff = tomorrow - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    countdownEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  tick();
  if (window._cdInterval) clearInterval(window._cdInterval);
  window._cdInterval = setInterval(tick, 1000);
}

export function disableGame() {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Come back tomorrow';
  if (sortable) sortable.option('disabled', true);
  Array.from(listEl.children).forEach(li => li.style.cursor = 'default');
}

export function showError(msg) {
  errorToast.textContent = msg;
  errorToast.classList.add('show');
  setTimeout(() => errorToast.classList.remove('show'), 4000);
}

export function renderStats(stats) {
  streakVal.textContent = stats.currentStreak || 0;
  bestVal.textContent = stats.maxStreak || 0;
}
