const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Read existing JSON to preserve UUIDs
const existingJson = JSON.parse(fs.readFileSync('puzzles/contemporary-modern.json', 'utf8'));
const existingMap = new Map();
existingJson.forEach(ev => {
  const key = ev.text + '|' + ev.year + '|' + ev.month + '|' + ev.day;
  existingMap.set(key, ev.id);
});

// Read new events from raw file
const rawFile = 'C:/Users/marcw/AppData/Local/Temp/opencode/new-contemporary-events.txt';
const newLines = fs.readFileSync(rawFile, 'utf8').trim().split('\n');

function smartParse(line) {
  // Find all 4-digit year candidates (1000-9999)
  const yearMatches = [...line.matchAll(/\b(\d{4})\b/g)];
  // The correct year is the one followed by a slug (no commas, no spaces, reasonable length)
  let yearIdx = -1;
  let year = null;
  for (const m of yearMatches) {
    const after = line.slice(m.index + 4);
    // Skip leading comma if present
    const afterTrim = after.replace(/^,/, '');
    const nextComma = afterTrim.indexOf(',');
    if (nextComma >= 0 && nextComma < 60) {
      const candidate = afterTrim.slice(0, nextComma);
      if (/^[a-z0-9-]+$/.test(candidate)) {
        year = parseInt(m[1], 10);
        yearIdx = m.index;
        break;
      }
    }
  }
  if (!year) {
    console.log('Could not find year in:', line.substring(0, 80));
    return null;
  }

  // Everything before year is text + month + day
  const before = line.slice(0, yearIdx).trim();
  // Remove trailing comma
  const beforeClean = before.replace(/,$/, '');
  // Last two numbers before year are day and month
  const numMatches = [...beforeClean.matchAll(/\b(\d{1,2})\b/g)];
  if (numMatches.length < 2) {
    console.log('Could not find month/day in:', beforeClean.substring(0, 80));
    return null;
  }
  const day = parseInt(numMatches[numMatches.length - 1][1], 10);
  const month = parseInt(numMatches[numMatches.length - 2][1], 10);

  // Text is everything before the month number
  const monthMatch = numMatches[numMatches.length - 2];
  let text = beforeClean.slice(0, monthMatch.index).trim();
  // Remove trailing comma and surrounding quotes
  text = text.replace(/,$/, '').replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"').trim();

  // Everything after year
  const afterYear = line.slice(yearIdx + 4).trim();
  // Remove leading comma
  const afterClean = afterYear.replace(/^,/, '');

  // Split remaining by comma, but respect quotes
  const fields = [];
  let cur = '';
  let q = false;
  for (let j = 0; j < afterClean.length; j++) {
    const ch = afterClean[j];
    if (ch === '"') {
      q = !q;
      cur += ch;
    } else if (ch === ',' && !q) {
      fields.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());

  const slug = fields[0];
  const url = fields[1]?.replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"') || '';
  const sourceText = fields[2]?.replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"') || '';

  return { text, month, day, year, slug, url, sourceText };
}

function csvQuote(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const allEvents = [];

// Add existing events
existingJson.forEach(ev => {
  allEvents.push({
    text: ev.text,
    month: ev.month,
    day: ev.day,
    year: ev.year,
    slug: ev.image.local.replace('images/', '').replace('.webp', ''),
    url: ev.source.url,
    sourceText: ev.source.text,
    id: ev.id
  });
});

// Add new events
newLines.forEach(line => {
  const parsed = smartParse(line);
  if (!parsed) return;
  allEvents.push({
    ...parsed,
    id: ''
  });
});

// Sort by year, month, day
allEvents.sort((a, b) => {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
});

// Generate UUIDs for new events
let newCount = 0;
allEvents.forEach(ev => {
  if (!ev.id) {
    ev.id = uuidv4();
    newCount++;
  }
});

// Write CSV
let csvOut = 'text,month,day,year,slug,url,source_text\n';
allEvents.forEach(ev => {
  csvOut += csvQuote(ev.text) + ',' + ev.month + ',' + ev.day + ',' + ev.year + ',' + csvQuote(ev.slug) + ',' + csvQuote(ev.url) + ',' + csvQuote(ev.sourceText) + '\n';
});
fs.writeFileSync('data/contemporary-modern.csv', csvOut);

// Write JSON
const jsonEvents = allEvents.map(ev => ({
  id: ev.id,
  year: ev.year,
  month: ev.month,
  day: ev.day,
  text: ev.text,
  image: { url: null, local: 'images/' + ev.slug + '.webp' },
  source: { text: ev.sourceText, url: ev.url }
}));
fs.writeFileSync('puzzles/contemporary-modern.json', JSON.stringify(jsonEvents, null, 2) + '\n');

console.log('Total events:', allEvents.length);
console.log('New events with UUIDs:', newCount);

// Validate
const bad = allEvents.find(e => e.year < 1000);
if (bad) {
  console.log('VALIDATION FAILED - bad year:', bad.year, 'in', bad.text);
  process.exit(1);
}
console.log('Validation passed: all years are 4-digit');
