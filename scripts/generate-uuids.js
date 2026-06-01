import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const puzzlesDir = path.join(__dirname, '..', 'puzzles');

const periodFiles = [
  'precolonial.json',
  'spanish.json',
  'revolution-american.json',
  'postwar.json',
  'marcos-edsa.json',
  'contemporary-early.json',
  'contemporary-modern.json',
];

async function addMissingUuids() {
  let changedAny = false;

  for (const filename of periodFiles) {
    const filepath = path.join(puzzlesDir, filename);
    let events;
    try {
      const raw = await fs.readFile(filepath, 'utf-8');
      events = JSON.parse(raw);
    } catch (e) {
      console.log(`Skipping ${filename} (not found or invalid JSON)`);
      continue;
    }

    if (!Array.isArray(events)) {
      console.log(`Skipping ${filename} (not an array)`);
      continue;
    }

    let changed = false;
    for (const ev of events) {
      if (!ev.id) {
        ev.id = uuidv4();
        changed = true;
        changedAny = true;
      }
    }

    if (changed) {
      await fs.writeFile(filepath, JSON.stringify(events, null, 2) + '\n');
      console.log(`Updated ${filename} — added UUIDs`);
    } else {
      console.log(`${filename} — all events already have UUIDs`);
    }
  }

  if (changedAny) {
    console.log('\nDone! Don\'t forget to commit the updated files.');
  } else {
    console.log('\nNo changes needed.');
  }
}

addMissingUuids().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
