import { seededRandom } from './seeded-random.js';

// Per-period maximum events per puzzle
const MAX_PER_PERIOD = {
  'pre-1898': 1,
  'modern': 3,
  'contemporary-early': 3,
  'contemporary-modern': 3
};
const GLOBAL_MAX_PER_PERIOD = Math.max(...Object.values(MAX_PER_PERIOD));

const MIN_PERIODS = 4;
const EVENTS_PER_PUZZLE = 7;

function compareEvents(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  const ma = a.month || 1;
  const mb = b.month || 1;
  if (ma !== mb) return ma - mb;
  return (a.day || 1) - (b.day || 1);
}

function shuffle(arr, rng) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isChronologicallySorted(display) {
  return display.every((e, i, a) => !i || compareEvents(a[i - 1], e) <= 0);
}

// Generate a random valid distribution of 7 events across periods
// Respects GLOBAL_MAX_PER_PERIOD so no count exceeds any period's cap
function generateDistribution(numPeriods, rng) {
  const distributionsByPeriods = {
    2: [[4, 3], [3, 4]],
    3: [[3, 3, 1], [3, 2, 2], [4, 2, 1]],
    4: [[3, 2, 1, 1], [2, 2, 2, 1], [4, 1, 1, 1]],
    5: [[3, 1, 1, 1, 1], [2, 2, 1, 1, 1]],
    6: [[2, 1, 1, 1, 1, 1]],
    7: [[1, 1, 1, 1, 1, 1, 1]]
  };

  // Filter out distributions where any count exceeds the global max cap
  const candidates = (distributionsByPeriods[numPeriods] || distributionsByPeriods[7])
    .filter(dist => dist.every(count => count <= GLOBAL_MAX_PER_PERIOD));

  if (candidates.length === 0) {
    throw new Error(`No valid distribution found for ${numPeriods} periods with max ${GLOBAL_MAX_PER_PERIOD}`);
  }

  const idx = Math.floor(rng() * candidates.length);
  return [...candidates[idx]]; // Return a copy
}

export function generatePuzzle(dateStr, availableEvents) {
  const rng = seededRandom('chronos-daily:' + dateStr);

  // Group events by period
  const byPeriod = {};
  for (const ev of availableEvents) {
    if (!byPeriod[ev.period]) byPeriod[ev.period] = [];
    byPeriod[ev.period].push(ev);
  }

  const periods = Object.keys(byPeriod);

  // If we don't have enough periods or total events, throw
  if (periods.length < MIN_PERIODS) {
    throw new Error(`Need at least ${MIN_PERIODS} periods with available events, found ${periods.length}`);
  }
  if (availableEvents.length < EVENTS_PER_PUZZLE) {
    throw new Error(`Need at least ${EVENTS_PER_PUZZLE} available events, found ${availableEvents.length}`);
  }

  // Try up to 50 times to find a valid assignment
  for (let attempt = 0; attempt < 50; attempt++) {
    const dist = generateDistribution(periods.length, rng);
    const shuffledPeriods = shuffle(periods, rng);

    const periodCounts = {};
    for (let i = 0; i < dist.length; i++) {
      periodCounts[shuffledPeriods[i]] = dist[i];
    }

    // Check if each period has enough events and respects per-period max cap
    let feasible = true;
    for (const [period, count] of Object.entries(periodCounts)) {
      if (!byPeriod[period] || byPeriod[period].length < count) {
        feasible = false;
        break;
      }
      const maxForPeriod = MAX_PER_PERIOD[period] ?? GLOBAL_MAX_PER_PERIOD;
      if (count > maxForPeriod) {
        feasible = false;
        break;
      }
    }

    if (!feasible) continue;

    // Select events
    const selected = [];
    const usedEventIds = new Set();

    for (const [period, count] of Object.entries(periodCounts)) {
      if (count === 0) continue;
      const pool = shuffle(byPeriod[period], rng);
      let picked = 0;
      for (const ev of pool) {
        if (usedEventIds.has(ev.id)) continue;
        selected.push(ev);
        usedEventIds.add(ev.id);
        picked++;
        if (picked >= count) break;
      }
      if (picked < count) {
        feasible = false;
        break;
      }
    }

    if (!feasible || selected.length !== EVENTS_PER_PUZZLE) continue;

    // Create display order (shuffled) and answer order (chronological)
    const display = shuffle(selected, rng);

    // Ensure display isn't accidentally already sorted
    if (isChronologicallySorted(display)) {
      [display[0], display[1]] = [display[1], display[0]];
    }

    const answer = [...selected].sort(compareEvents);

    return {
      date: dateStr,
      events: display,
      answerOrder: answer.map(e => e.id)
    };
  }

  throw new Error('Failed to generate a valid puzzle after 50 attempts');
}
