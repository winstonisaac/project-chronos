import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Load .env file if present
try {
  const { config } = await import('dotenv');
  config();
} catch (e) {
  // dotenv not installed, ignore
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const puzzlesDir = path.join(__dirname, '..', 'puzzles');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const periodFiles = [
  { file: 'pre-1898.json', period: 'pre-1898' },
  { file: 'modern.json', period: 'modern' },
  { file: 'contemporary-early.json', period: 'contemporary-early' },
  { file: 'contemporary-modern.json', period: 'contemporary-modern' },
];

async function seed() {
  let totalUpserted = 0;
  let totalSkipped = 0;

  for (const { file, period } of periodFiles) {
    const filepath = path.join(puzzlesDir, file);
    let events;
    try {
      const raw = await fs.readFile(filepath, 'utf-8');
      events = JSON.parse(raw);
    } catch (e) {
      console.log(`Skipping ${file} (not found or invalid JSON)`);
      continue;
    }

    if (!Array.isArray(events)) {
      console.log(`Skipping ${file} (not an array)`);
      continue;
    }

    const rows = [];
    for (const ev of events) {
      if (!ev.id) {
        console.warn(`  Skipping event without id in ${file}: ${ev.text?.slice(0, 40) || '(no text)'}`);
        totalSkipped++;
        continue;
      }

      rows.push({
        id: ev.id,
        year: ev.year,
        month: ev.month || null,
        day: ev.day || null,
        text: ev.text,
        period: period,
        image_url: ev.image?.url || null,
        image_local: ev.image?.local || null,
        source_text: ev.source?.text || null,
        source_url: ev.source?.url || null,
        // last_used is intentionally NOT set here — it is managed by the cron job
      });
    }

    if (rows.length === 0) {
      console.log(`${file} — no valid events to upsert`);
      continue;
    }

    const { error } = await supabaseAdmin
      .from('events')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error(`  Error upserting ${file}:`, error.message);
    } else {
      console.log(`${file} — upserted ${rows.length} events`);
      totalUpserted += rows.length;
    }
  }

  console.log(`\nTotal: ${totalUpserted} events upserted, ${totalSkipped} skipped`);
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
