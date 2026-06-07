import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env
const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) env[match[1]] = match[2];
}

const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function getManilaDateStr(date = new Date()) {
  const manila = date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [m, d, y] = manila.split('/');
  return `${y}-${m}-${d}`;
}

const todayStr = getManilaDateStr();
console.log('Today:', todayStr);

// 1. Delete template pre-1898 events (year=0)
const { error: deleteEventsError } = await supabaseAdmin
  .from('events')
  .delete()
  .eq('period', 'pre-1898')
  .eq('year', 0);

if (deleteEventsError) {
  console.error('Error deleting template events:', deleteEventsError.message);
} else {
  console.log('Deleted template pre-1898 events (year=0)');
}

// 2. Delete today's puzzle to force regeneration
const { error: deletePuzzleError } = await supabaseAdmin
  .from('daily_puzzles')
  .delete()
  .eq('date', todayStr);

if (deletePuzzleError) {
  console.error('Error deleting today puzzle:', deletePuzzleError.message);
} else {
  console.log('Deleted today puzzle. It will regenerate on next API call.');
}

console.log('\nDone! Visit the site to trigger puzzle regeneration.');
