import { MAX_TRIES, EVENTS_PER_PUZZLE, getManilaDateStr } from './config.js';
import { fetchToday, submitAnswer } from './api.js';
import { loadStats, updateStats, loadDayState, saveDayState } from './storage.js';
import { initAuth, getCurrentUser, signIn, signUp, signOut } from './auth.js';
import { fmtDate, dayNumber } from './game.js';
import * as ui from './ui.js';

// Game state
let puzzle = null;
let gameFinished = false;
let triesUsed = 0;

// Reading mode
const READING_MODE_KEY = 'chronos_reading_mode';
const readingModeInput = document.getElementById('reading-mode-input');

// Auth modal state
let authMode = 'login'; // 'login' or 'signup'

function initReadingMode() {
  if (!readingModeInput) return;
  const saved = localStorage.getItem(READING_MODE_KEY);
  const enabled = saved === 'true';
  readingModeInput.checked = enabled;
  ui.setReadingMode(enabled);
  const mobileToggle = document.getElementById('mobile-reading-mode-input');
  if (mobileToggle) mobileToggle.checked = enabled;
}

function handleReadingModeToggle() {
  const enabled = readingModeInput.checked;
  localStorage.setItem(READING_MODE_KEY, String(enabled));
  ui.setReadingMode(enabled);
  const mobileToggle = document.getElementById('mobile-reading-mode-input');
  if (mobileToggle) mobileToggle.checked = enabled;
}

async function start() {
  const todayStr = getManilaDateStr();
  ui.dateDisplay.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  ui.renderStats(loadStats());

  try {
    const data = await fetchToday();
    puzzle = {
      todayStr: data.puzzle.date,
      events: data.puzzle.events
    };

    const dayState = loadDayState(todayStr);

    if (dayState && dayState.finished) {
      restoreFinishedState(dayState);
    } else if (data.progress && data.progress.finished) {
      restoreFinishedState(data.progress);
    } else if (dayState) {
      restoreInProgressState(dayState);
    } else if (data.progress) {
      restoreInProgressState(data.progress);
    } else {
      startNewGame();
    }
  } catch (err) {
    ui.showError('Failed to load puzzle. Please try again later.');
    console.error(err);
  }
}

function restoreFinishedState(state) {
  const answerEvents = state.answerEvents || puzzle.events;
  const answerOrder = state.answerOrder || [];
  const userOrder = state.order || [];

  // Store for toggle
  window._lastUserOrder = userOrder;
  window._lastAnswerOrder = answerOrder;
  window._lastAnswerEvents = answerEvents;

  if (state.won) {
    const orderIds = state.order || [];
    const eventMap = new Map(answerEvents.map(e => [e.id, e]));
    const items = orderIds.map(id => eventMap.get(id)).filter(Boolean);
    const allLocked = new Set([0,1,2,3,4,5,6]);
    if (items.length === EVENTS_PER_PUZZLE) {
      ui.renderSlots(items, allLocked);
    } else {
      ui.renderSlots(answerEvents, allLocked);
    }
    ui.revealAll(answerEvents);
  } else {
    if (answerOrder.length === EVENTS_PER_PUZZLE) {
      ui.finalizeLossState(userOrder, answerOrder, answerEvents);
    } else {
      const noneLocked = new Set();
      ui.renderSlots(answerEvents, noneLocked);
      // Force reveal sources and dates since game is over
      const slots = ui.slotsContainer?.children;
      if (slots) {
        Array.from(slots).forEach((slot, i) => {
          const item = slot.querySelector('.event-item');
          if (item) {
            const ev = answerEvents[i];
            const yearEl = item.querySelector('.event-year');
            if (ev) yearEl.textContent = fmtDate(ev);
            yearEl.classList.add('revealed');
            const sourceEl = item.querySelector('.event-source');
            if (sourceEl) sourceEl.classList.add('visible');
          }
        });
      }
    }
  }

  ui.showAnswerToggle();
  ui.disableGame();
  ui.instructionCard.innerHTML = state.won
    ? '<strong>You already played today.</strong> See you tomorrow for the next puzzle!'
    : '<strong>You already played today.</strong> Here is the correct order.';
  if (!state.won) {
    const stats = loadStats();
    ui.showOverlay(false, state.triesUsed || state.tries || MAX_TRIES, stats, answerEvents);
  }
}

function restoreInProgressState(state) {
  triesUsed = state.triesUsed || state.tries || 0;
  const orderIds = state.order || [];
  const eventMap = new Map(puzzle.events.map(e => [e.id, e]));
  const items = orderIds.map(id => eventMap.get(id)).filter(Boolean);
  const correctPositions = new Set(state.correctPositions || []);

  if (items.length === EVENTS_PER_PUZZLE) {
    ui.renderSlots(items, correctPositions);
  } else {
    ui.renderSlots(puzzle.events, correctPositions);
  }

  ui.initSortable(ui.clearMarks);
  ui.updateTriesUI(triesUsed);

  if (triesUsed >= MAX_TRIES) {
    const answerOrder = state.answerOrder || [];
    if (answerOrder.length === EVENTS_PER_PUZZLE) {
      ui.finalizeLossState(orderIds, answerOrder, puzzle.events);
    }
    ui.disableGame();
    return;
  }

  if (triesUsed > 0) {
    ui.evaluateAndMark([...correctPositions]);
  }
}

function startNewGame() {
  triesUsed = 0;
  gameFinished = false;
  ui.setGameOver(false);
  document.querySelector('.layout')?.classList.remove('game-over');

  // Restore reading mode toggle for new game
  const readingToggle = document.querySelector('.reading-mode-toggle');
  if (readingToggle) readingToggle.style.display = '';

  ui.updateTriesUI(triesUsed);
  ui.renderSlots(puzzle.events, new Set());
  ui.initSortable(ui.clearMarks);
  ui.hideAnswerToggle();
  ui.submitBtn.disabled = false;
  ui.submitBtn.textContent = 'Submit';
  const mobileSubmitBtn = document.getElementById('mobile-submit-btn');
  if (mobileSubmitBtn) {
    mobileSubmitBtn.disabled = false;
    mobileSubmitBtn.textContent = 'SUBMIT';
  }
  ui.instructionCard.innerHTML = `
    <strong>Sort these 7 events from earliest to latest.</strong>
    Drag the cards into chronological order, then press <strong>Submit</strong>.
    Correctly placed events will be marked. You have <strong>${MAX_TRIES} tries</strong>.
  `;
}

async function handleSubmit() {
  if (gameFinished || !puzzle) return;

  const userOrder = ui.getUserOrder();
  if (userOrder.length !== EVENTS_PER_PUZZLE) {
    ui.showError('Something went wrong. Please refresh the page.');
    return;
  }

  triesUsed += 1;

  try {
    const result = await submitAnswer(userOrder, triesUsed);
    ui.evaluateAndMark(result.correctPositions);
    ui.updateTriesUI(triesUsed);

    const gameOver = result.won || triesUsed >= MAX_TRIES;

    const state = {
      tries: triesUsed,
      triesUsed: triesUsed,
      order: userOrder,
      finished: gameOver,
      won: result.won,
      correctPositions: result.correctPositions,
      answerOrder: result.answerOrder
    };

    if (gameOver) {
      state.answerEvents = result.answerEvents;
      const stats = updateStats(result.won, puzzle.todayStr);
      ui.renderStats(stats);
      ui.disableGame();
      ui.showAnswerToggle();

      // Store for toggle
      window._lastUserOrder = userOrder;
      window._lastAnswerOrder = result.answerOrder;
      window._lastAnswerEvents = result.answerEvents;

      if (result.won) {
        gameFinished = true;
        ui.revealAll(result.answerEvents);
        ui.showOverlay(true, triesUsed, stats, null);
      } else {
        gameFinished = true;
        ui.finalizeLossState(userOrder, result.answerOrder, result.answerEvents);
        ui.showOverlay(false, triesUsed, stats, result.answerEvents);
      }
    } else {
      ui.submitBtn.textContent = 'Submit again';
      const mobileSubmitBtn2 = document.getElementById('mobile-submit-btn');
      if (mobileSubmitBtn2) mobileSubmitBtn2.textContent = 'SUBMIT AGAIN';
    }

    saveDayState(puzzle.todayStr, state);
  } catch (err) {
    ui.showError(err.message);
    triesUsed -= 1;
  }
}

async function doShare() {
  if (!puzzle) return;
  const stats = loadStats();
  const won = gameFinished && stats.lastCompleted === puzzle.todayStr;
  const text = generateShareText(won);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Chronos', text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      ui.shareBtn.textContent = 'Copied!';
      setTimeout(() => ui.shareBtn.textContent = 'Share', 1500);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      ui.shareBtn.textContent = 'Copied!';
      setTimeout(() => ui.shareBtn.textContent = 'Share', 1500);
    }
  } catch (e) {}
}

function generateShareText(won) {
  const dn = dayNumber(puzzle.todayStr);
  const stats = loadStats();
  const streak = stats.currentStreak;
  const tries = won ? triesUsed : 'X';
  const emoji = won ? '🔥' : '💥';
  const status = won ? 'Solved' : 'Missed';
  const url = typeof window !== 'undefined' ? window.location.href : '';
  return `Chronos ${dn} ${tries}/${MAX_TRIES} ${emoji} ${status}\nStreak: ${streak}\n${url}`;
}

// ===================== AUTH UI =====================

const authOverlay = document.getElementById('auth-overlay');
const authFormTitle = document.getElementById('auth-form-title');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authActionBtn = document.getElementById('auth-action-btn');
const authToggle = document.getElementById('auth-toggle');
const authError = document.getElementById('auth-error');
const authClose = document.getElementById('auth-close');

function openAuth(mode = 'login') {
  authMode = mode;
  authEmail.value = '';
  authPassword.value = '';
  authError.textContent = '';
  updateAuthFormUI();
  authOverlay.classList.add('show');
  authOverlay.setAttribute('aria-hidden', 'false');
}

function closeAuth() {
  authOverlay.classList.remove('show');
  authOverlay.setAttribute('aria-hidden', 'true');
}

function updateAuthFormUI() {
  if (authMode === 'login') {
    authFormTitle.textContent = 'Sign In';
    authActionBtn.textContent = 'Sign In';
    authToggle.textContent = 'Need an account? Sign up';
  } else {
    authFormTitle.textContent = 'Sign Up';
    authActionBtn.textContent = 'Sign Up';
    authToggle.textContent = 'Already have an account? Sign in';
  }
}

async function handleAuthAction(e) {
  e.preventDefault();
  authError.textContent = '';
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    authError.textContent = 'Please enter email and password.';
    return;
  }

  authActionBtn.disabled = true;
  authActionBtn.textContent = authMode === 'login' ? 'Signing in...' : 'Signing up...';

  try {
    if (authMode === 'login') {
      await signIn(email, password);
    } else {
      await signUp(email, password);
      // Supabase may require email confirmation depending on settings
      alert('Check your email for a confirmation link!');
    }
    closeAuth();
  } catch (err) {
    authError.textContent = err.message || 'Authentication failed.';
  } finally {
    authActionBtn.disabled = false;
    updateAuthFormUI();
  }
}

function updateAuthSectionUI(user) {
  if (!ui.authSection) return;
  if (user) {
    ui.authSection.innerHTML = `
      <span class="user-name">${user.email}</span>
      <button id="logout-btn" class="secondary">Log out</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await signOut();
    });
  } else {
    ui.authSection.innerHTML = `
      <button id="login-btn" class="secondary">Sign In</button>
    `;
    document.getElementById('login-btn').addEventListener('click', () => openAuth('login'));
  }
}

window.addEventListener('auth-state-changed', (e) => {
  updateAuthSectionUI(e.detail.user);
});

if (authActionBtn) authActionBtn.addEventListener('click', handleAuthAction);
if (authToggle) authToggle.addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  updateAuthFormUI();
});
if (authClose) authClose.addEventListener('click', closeAuth);

// ===================== READING MODE =====================

if (readingModeInput) {
  readingModeInput.addEventListener('change', handleReadingModeToggle);
}

// ===================== EVENT LISTENERS =====================

ui.submitBtn.addEventListener('click', handleSubmit);
const mobileSubmitBtn = document.getElementById('mobile-submit-btn');
if (mobileSubmitBtn) mobileSubmitBtn.addEventListener('click', handleSubmit);

ui.shareBtn.addEventListener('click', doShare);
ui.closeModalBtn.addEventListener('click', () => {
  ui.overlay.classList.remove('show');
  ui.overlay.setAttribute('aria-hidden', 'true');
});

// Answer toggle buttons
const showCorrectBtn = document.getElementById('show-correct-btn');
const showGuessBtn = document.getElementById('show-guess-btn');

if (showCorrectBtn && showGuessBtn) {
  showCorrectBtn.addEventListener('click', () => {
    showCorrectBtn.classList.add('active');
    showGuessBtn.classList.remove('active');
    if (window._lastAnswerOrder && window._lastAnswerEvents) {
      if (window._lastUserOrder) {
        ui.finalizeLossState(window._lastUserOrder, window._lastAnswerOrder, window._lastAnswerEvents);
      } else {
        // Won state
        const allLocked = new Set([0,1,2,3,4,5,6]);
        ui.renderSlots(window._lastAnswerEvents, allLocked);
        ui.revealAll(window._lastAnswerEvents);
      }
    }
  });

  showGuessBtn.addEventListener('click', () => {
    showGuessBtn.classList.add('active');
    showCorrectBtn.classList.remove('active');
    if (window._lastUserOrder && window._lastAnswerEvents) {
      ui.renderUserGuess(window._lastUserOrder, window._lastAnswerEvents);
    }
  });
}

// Mobile answer toggle buttons
const mobileShowCorrectBtn = document.getElementById('mobile-show-correct-btn');
const mobileShowGuessBtn = document.getElementById('mobile-show-guess-btn');

if (mobileShowCorrectBtn && mobileShowGuessBtn) {
  mobileShowCorrectBtn.addEventListener('click', () => {
    mobileShowCorrectBtn.classList.add('active');
    mobileShowGuessBtn.classList.remove('active');
    if (window._lastAnswerOrder && window._lastAnswerEvents) {
      if (window._lastUserOrder) {
        ui.finalizeLossState(window._lastUserOrder, window._lastAnswerOrder, window._lastAnswerEvents);
      } else {
        const allLocked = new Set([0,1,2,3,4,5,6]);
        ui.renderSlots(window._lastAnswerEvents, allLocked);
        ui.revealAll(window._lastAnswerEvents);
      }
    }
  });

  mobileShowGuessBtn.addEventListener('click', () => {
    mobileShowGuessBtn.classList.add('active');
    mobileShowCorrectBtn.classList.remove('active');
    if (window._lastUserOrder && window._lastAnswerEvents) {
      ui.renderUserGuess(window._lastUserOrder, window._lastAnswerEvents);
    }
  });
}

// ===================== ONBOARDING =====================

const ONBOARDED_KEY = 'chronos_onboarded';
const onboardingOverlay = document.getElementById('onboarding-overlay');
const onboardingNext = document.getElementById('onboarding-next');
const onboardingGotIt = document.getElementById('onboarding-got-it');
const onboardingClose = document.getElementById('onboarding-close');
const desktopHelpBtn = document.getElementById('desktop-help-btn');
const mobileHelpBtn = document.getElementById('mobile-help-btn');

let currentSlide = 0;
const totalSlides = 3;

function showOnboardingSlide(index) {
  const slides = document.querySelectorAll('.onboarding-slide');
  slides.forEach(s => s.classList.remove('active'));

  // Pick the correct variant (desktop/mobile) for slide 1
  if (index === 1) {
    const isMobile = window.innerWidth <= 480;
    const variant = document.querySelector(`.onboarding-slide[data-slide="1"].${isMobile ? 'mobile-only' : 'desktop-only'}`);
    if (variant) variant.classList.add('active');
  } else {
    const slide = document.querySelector(`.onboarding-slide[data-slide="${index}"]:not(.mobile-only):not(.desktop-only)`);
    if (slide) slide.classList.add('active');
  }

  // Update dots
  document.querySelectorAll('.onboarding-dots .dot').forEach((d, i) => {
    d.classList.toggle('active', i === index);
  });

  // Toggle Next / Got it buttons
  if (index === totalSlides - 1) {
    onboardingNext?.classList.add('hidden');
    onboardingGotIt?.classList.remove('hidden');
  } else {
    onboardingNext?.classList.remove('hidden');
    onboardingGotIt?.classList.add('hidden');
  }
}

function openOnboarding() {
  currentSlide = 0;
  showOnboardingSlide(0);
  onboardingOverlay?.classList.add('show');
  onboardingOverlay?.setAttribute('aria-hidden', 'false');
}

function closeOnboarding() {
  onboardingOverlay?.classList.remove('show');
  onboardingOverlay?.setAttribute('aria-hidden', 'true');
  localStorage.setItem(ONBOARDED_KEY, 'true');
}

if (onboardingNext) {
  onboardingNext.addEventListener('click', () => {
    if (currentSlide < totalSlides - 1) {
      currentSlide++;
      showOnboardingSlide(currentSlide);
    }
  });
}

if (onboardingGotIt) {
  onboardingGotIt.addEventListener('click', closeOnboarding);
}

if (onboardingClose) {
  onboardingClose.addEventListener('click', closeOnboarding);
}

if (onboardingOverlay) {
  onboardingOverlay.querySelector('.overlay-bg')?.addEventListener('click', closeOnboarding);
}

if (desktopHelpBtn) {
  desktopHelpBtn.addEventListener('click', openOnboarding);
}

if (mobileHelpBtn) {
  mobileHelpBtn.addEventListener('click', openOnboarding);
}

// ===================== INIT =====================

document.addEventListener('DOMContentLoaded', () => {
  const supabaseUrl = window.SUPABASE_URL || '';
  const supabaseKey = window.SUPABASE_ANON_KEY || '';
  if (supabaseUrl && supabaseKey) {
    initAuth(supabaseUrl, supabaseKey);
    getCurrentUser().then(user => updateAuthSectionUI(user));
  }
  initReadingMode();
  start();

  // Show onboarding for first-time visitors
  const hasOnboarded = localStorage.getItem(ONBOARDED_KEY);
  if (!hasOnboarded) {
    setTimeout(openOnboarding, 800);
  }
});
