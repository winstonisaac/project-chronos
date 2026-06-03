import { MAX_TRIES, EVENTS_PER_PUZZLE } from './config.js';
import { fmtDate, getImageUrl } from './game.js';

// Slot container
export const slotsContainer = document.getElementById('slots-container');

// DOM element references
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

export function isReadingMode() {
  return readingMode;
}

export function setReadingMode(enabled) {
  readingMode = enabled;
  refreshAllEventItems();
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

function getSlots() {
  return Array.from(slotsContainer.children);
}

function createEventItem(ev) {
  const li = document.createElement('div');
  li.className = 'event-item';
  li.dataset.id = ev.id;
  li.draggable = true;

  const thumbLetter = ev.text ? ev.text.charAt(0).toUpperCase() : '?';
  const imgUrl = getImageUrl(ev);
  const thumbHtml = imgUrl
    ? `<img src="${imgUrl}" alt="" data-img-url="${imgUrl}" data-caption="${ev.text.replace(/"/g, '&quot;')}" onerror="this.parentElement.textContent='${thumbLetter}'">`
    : thumbLetter;

  let sourceText = ev.source?.text || ev.source_text || '';
  const sourceUrl = ev.source?.url || ev.source_url || '';
  if (readingMode && sourceText) {
    sourceText = sourceText.replace(/\([^)]*\)/g, '(■■■■)');
  }
  const showSource = readingMode;
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
    <div class="event-year"></div>
    <div class="drag-handle">⋮⋮</div>
  `;

  // Click-to-enlarge image
  li.querySelector('.event-thumb')?.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') {
      openLightbox(e.target.dataset.imgUrl, e.target.dataset.caption);
    }
  });

  return li;
}

export function renderSlots(items, lockedIndices = new Set()) {
  const slots = getSlots();
  items.forEach((ev, idx) => {
    const slot = slots[idx];
    slot.innerHTML = '';
    slot.classList.remove('locked', 'drag-over');
    const item = createEventItem(ev);
    slot.appendChild(item);
    if (lockedIndices.has(idx)) {
      slot.classList.add('locked');
      item.classList.add('correct', 'locked');
      item.draggable = false;
      item.style.cursor = 'default';
    }
  });
}

function refreshAllEventItems() {
  const slots = getSlots();
  slots.forEach(slot => {
    const item = slot.querySelector('.event-item');
    if (!item) return;
    const sourceEl = item.querySelector('.event-source');
    if (!sourceEl) return;

    // Re-apply reading mode visibility
    if (readingMode) {
      sourceEl.classList.add('visible');
      // Re-apply redaction
      const originalText = sourceEl.textContent;
      if (!originalText.includes('■■■■')) {
        sourceEl.textContent = originalText.replace(/\([^)]*\)/g, '(■■■■)');
      }
    } else {
      if (!slot.classList.contains('locked')) {
        sourceEl.classList.remove('visible');
      }
    }
  });
}

// Native HTML5 DnD for slot-based swapping
let draggedItem = null;
let sourceSlot = null;

function initDnD() {
  slotsContainer.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.event-item');
    if (!item || item.classList.contains('locked')) {
      e.preventDefault();
      return;
    }
    draggedItem = item;
    sourceSlot = item.parentElement;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });

  slotsContainer.addEventListener('dragend', () => {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
      draggedItem = null;
      sourceSlot = null;
    }
    getSlots().forEach(s => s.classList.remove('drag-over'));
  });

  slotsContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    const slot = e.target.closest('.event-slot');
    if (!slot) return;

    getSlots().forEach(s => s.classList.remove('drag-over'));

    if (!slot.classList.contains('locked')) {
      slot.classList.add('drag-over');
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  });

  slotsContainer.addEventListener('dragleave', (e) => {
    const slot = e.target.closest('.event-slot');
    if (slot) slot.classList.remove('drag-over');
  });

  slotsContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const slot = e.target.closest('.event-slot');
    if (!slot || !draggedItem) return;

    slot.classList.remove('drag-over');

    if (slot.classList.contains('locked')) {
      // Reject drop on locked slot
      return;
    }

    const targetItem = slot.querySelector('.event-item');

    if (slot === sourceSlot) {
      // Dropped in same slot — nothing to do
      return;
    }

    // Swap items between slots
    if (targetItem) {
      sourceSlot.appendChild(targetItem);
    }
    slot.appendChild(draggedItem);
  });
}

initDnD();

// Touch swipe-to-swap for mobile
const SWIPE_THRESHOLD = 80;
let touchStartX = 0;
let touchCurrentX = 0;
let touchSlotIndex = -1;
let touchItem = null;

function getSlotIndex(slot) {
  return Array.from(slotsContainer.children).indexOf(slot);
}

slotsContainer.addEventListener('touchstart', (e) => {
  const item = e.target.closest('.event-item');
  if (!item || item.classList.contains('locked')) return;
  const slot = item.parentElement;
  if (!slot || slot.classList.contains('locked')) return;

  touchItem = item;
  touchSlotIndex = getSlotIndex(slot);
  touchStartX = e.touches[0].clientX;
  touchCurrentX = touchStartX;
}, { passive: true });

slotsContainer.addEventListener('touchmove', (e) => {
  if (!touchItem) return;
  touchCurrentX = e.touches[0].clientX;
  const diff = touchCurrentX - touchStartX;
  // Visual feedback
  touchItem.style.transform = `translateX(${diff}px)`;
  touchItem.style.transition = 'none';
}, { passive: true });

slotsContainer.addEventListener('touchend', () => {
  if (!touchItem) return;

  const diff = touchCurrentX - touchStartX;
  touchItem.style.transform = '';
  touchItem.style.transition = '';

  if (Math.abs(diff) >= SWIPE_THRESHOLD) {
    const direction = diff > 0 ? 1 : -1; // right = +1 (swap with next), left = -1 (swap with prev)
    const targetIndex = touchSlotIndex + direction;
    const slots = getSlots();

    if (targetIndex >= 0 && targetIndex < slots.length) {
      const targetSlot = slots[targetIndex];
      if (!targetSlot.classList.contains('locked')) {
        // Swap
        const targetItem = targetSlot.querySelector('.event-item');
        const sourceSlot = slots[touchSlotIndex];
        if (targetItem) {
          sourceSlot.appendChild(targetItem);
        }
        targetSlot.appendChild(touchItem);
      }
    }
  }

  touchItem = null;
  touchSlotIndex = -1;
  touchStartX = 0;
  touchCurrentX = 0;
});

export function initSortable(onStart) {
  // No-op: slots handle their own DnD. Kept for API compatibility.
}

export function clearMarks() {
  getSlots().forEach(slot => {
    const item = slot.querySelector('.event-item');
    if (item && !item.classList.contains('locked')) {
      item.classList.remove('correct', 'wrong');
    }
  });
}

export function getUserOrder() {
  return getSlots().map(slot => {
    const item = slot.querySelector('.event-item');
    return item ? item.dataset.id : null;
  }).filter(Boolean);
}

export function evaluateAndMark(correctPositions) {
  lockedPositions = new Set(correctPositions);
  const slots = getSlots();
  slots.forEach((slot, i) => {
    const item = slot.querySelector('.event-item');
    if (!item) return;
    item.classList.remove('correct', 'wrong', 'locked');
    if (correctPositions.includes(i)) {
      item.classList.add('correct', 'locked');
      item.draggable = false;
      item.style.cursor = 'default';
      slot.classList.add('locked');
    } else {
      item.classList.add('wrong');
      item.draggable = true;
      item.style.cursor = 'grab';
      slot.classList.remove('locked');
    }
  });
}

export function revealAll(eventsWithDates) {
  const dateMap = eventsWithDates ? new Map(eventsWithDates.map(e => [e.id, e])) : null;
  getSlots().forEach(slot => {
    const item = slot.querySelector('.event-item');
    if (!item) return;
    item.classList.remove('wrong');
    item.classList.add('correct');
    const yearEl = item.querySelector('.event-year');
    if (dateMap) {
      const ev = dateMap.get(item.dataset.id);
      if (ev) yearEl.textContent = fmtDate(ev);
    }
    yearEl.classList.add('revealed');
    const sourceEl = item.querySelector('.event-source');
    if (sourceEl) sourceEl.classList.add('visible');
  });
}

export function finalizeLossState(userOrderIds, answerOrderIds, puzzleEvents) {
  const eventMap = new Map(puzzleEvents.map(e => [e.id, e]));
  const answerEvents = answerOrderIds.map(id => eventMap.get(id)).filter(Boolean);
  const slots = getSlots();

  answerEvents.forEach((ev, idx) => {
    const slot = slots[idx];
    slot.innerHTML = '';
    slot.classList.remove('locked', 'drag-over');
    const item = createEventItem(ev);
    slot.appendChild(item);
  });

  const correctIndices = new Set();
  userOrderIds.forEach((id, i) => {
    if (id === answerOrderIds[i]) correctIndices.add(i);
  });

  slots.forEach((slot, i) => {
    const item = slot.querySelector('.event-item');
    if (!item) return;
    const ev = answerEvents[i];
    const yearEl = item.querySelector('.event-year');
    if (ev) yearEl.textContent = fmtDate(ev);
    yearEl.classList.add('revealed');
    if (correctIndices.has(i)) {
      item.classList.add('correct');
    } else {
      item.classList.add('wrong');
    }
    const sourceEl = item.querySelector('.event-source');
    if (sourceEl) sourceEl.classList.add('visible');
  });
}

export function renderUserGuess(userOrderIds, events) {
  const eventMap = new Map(events.map(e => [e.id, e]));
  const guessEvents = userOrderIds.map(id => eventMap.get(id)).filter(Boolean);
  const slots = getSlots();

  guessEvents.forEach((ev, idx) => {
    const slot = slots[idx];
    slot.innerHTML = '';
    slot.classList.remove('locked', 'drag-over');
    const item = createEventItem(ev);
    slot.appendChild(item);
  });

  // Show dates on all
  slots.forEach((slot, i) => {
    const item = slot.querySelector('.event-item');
    if (!item) return;
    const ev = guessEvents[i];
    const yearEl = item.querySelector('.event-year');
    if (ev) yearEl.textContent = fmtDate(ev);
    yearEl.classList.add('revealed');
    const sourceEl = item.querySelector('.event-source');
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

export function showAnswerToggle() {
  const toggle = document.getElementById('answer-toggle');
  if (toggle) toggle.style.display = 'flex';
}

export function hideAnswerToggle() {
  const toggle = document.getElementById('answer-toggle');
  if (toggle) toggle.style.display = 'none';
}

export function disableGame() {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Come back tomorrow';
  getSlots().forEach(slot => {
    const item = slot.querySelector('.event-item');
    if (item) {
      item.draggable = false;
      item.style.cursor = 'default';
    }
  });
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
