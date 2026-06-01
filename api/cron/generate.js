import { supabaseAdmin } from '../lib/supabase.js';
import { getManilaDateStr, subtractDaysManila } from '../lib/time.js';
import { generatePuzzle } from '../lib/puzzle-generator.js';

const COOLDOWN_DAYS = 30;

export default async function handler(req, res) {
  // Vercel Cron jobs send POST requests
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
  }

  try {
    const todayStr = getManilaDateStr();

    // Check if puzzle already exists for today
    const { data: existing } = await supabaseAdmin
      .from('daily_puzzles')
      .select('id')
      .eq('date', todayStr)
      .single();

    if (existing) {
      return res.status(200).json({ message: 'Puzzle already generated for today', date: todayStr });
    }

    // Fetch available events (not used in last 30 days)
    const cutoffStr = subtractDaysManila(COOLDOWN_DAYS);
    const { data: availableEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .or(`last_used.is.null,last_used.lte.${cutoffStr}`);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    if (!availableEvents || availableEvents.length < 7) {
      return res.status(503).json({ error: `Not enough available events (${availableEvents?.length || 0})` });
    }

    // Generate puzzle
    const puzzle = generatePuzzle(todayStr, availableEvents);

    // Insert puzzle
    const { error: insertError } = await supabaseAdmin
      .from('daily_puzzles')
      .insert({
        date: puzzle.date,
        events: puzzle.events,
        answer_order: puzzle.answerOrder
      });

    if (insertError) {
      console.error('Error inserting puzzle:', insertError);
      return res.status(500).json({ error: 'Failed to save puzzle' });
    }

    // Update last_used on selected events
    const selectedIds = puzzle.events.map(e => e.id);
    const { error: updateError } = await supabaseAdmin
      .from('events')
      .update({ last_used: todayStr })
      .in('id', selectedIds);

    if (updateError) {
      console.error('Error updating last_used:', updateError);
      // Non-fatal: puzzle is already saved
    }

    return res.status(200).json({
      message: 'Puzzle generated successfully',
      date: todayStr,
      eventCount: selectedIds.length,
      periods: [...new Set(puzzle.events.map(e => e.period))]
    });
  } catch (err) {
    console.error('Error in cron generate:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
