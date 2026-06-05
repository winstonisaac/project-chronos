import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file
const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) env[match[1]] = match[2];
}

const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function updateConstraint() {
  // Try to create exec_sql function first
  const { error: funcError } = await supabaseAdmin
    .from('_temp')
    .select('*')
    .limit(0);
  
  // Use raw fetch to call SQL via PostgREST
  const sqlEndpoint = `${supabaseUrl}/rest/v1/`;
  
  // Drop old constraint
  const dropRes = await fetch(sqlEndpoint + 'rpc/exec_sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey
    },
    body: JSON.stringify({ sql: `ALTER TABLE events DROP CONSTRAINT IF EXISTS events_period_check;` })
  });
  
  if (!dropRes.ok) {
    const text = await dropRes.text();
    console.log('Drop constraint response:', text);
  } else {
    console.log('Dropped old constraint');
  }

  // Add new constraint
  const addRes = await fetch(sqlEndpoint + 'rpc/exec_sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey
    },
    body: JSON.stringify({ sql: `ALTER TABLE events ADD CONSTRAINT events_period_check CHECK (period IN ('precolonial', 'spanish', 'modern', 'contemporary-early', 'contemporary-modern'));` })
  });

  if (!addRes.ok) {
    const text = await addRes.text();
    console.log('Add constraint response:', text);
  } else {
    console.log('Added new constraint with modern period');
  }
}

updateConstraint().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
