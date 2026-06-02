import { supabase, supabaseAdmin, createUserClient } from './lib/supabase.js';
import { getManilaDateStr, subtractDaysManila } from './lib/time.js';
import { generatePuzzle } from './lib/puzzle-generator.js';

const COOLDOWN_DAYS = 30;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const todayStr = getManilaDateStr();

    // Fetch today's puzzle
    let { data: puzzle, error: puzzleError } = await supabase
      .from('daily_puzzles')
      .select('*')
      .eq('date', todayStr)
      .single();

    // If missing and admin client is available, generate on-the-fly
    if ((!puzzle || puzzleError) && supabaseAdmin) {
      const cutoffStr = subtractDaysManila(COOLDOWN_DAYS);
      const { data: availableEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('*')
        .or(`last_used.is.null,last_used.lte.${cutoffStr}`);

      if (eventsError || !availableEvents || availableEvents.length < 7) {
        return res.status(503).json({ error: 'Puzzle not yet available and not enough events to generate' });
      }

      const generated = generatePuzzle(todayStr, availableEvents);

      // Insert puzzle
      await supabaseAdmin
        .from('daily_puzzles')
        .upsert({
          date: generated.date,
          events: generated.events,
          answer_order: generated.answerOrder
        }, { onConflict: 'date' });

      // Update last_used on selected events
      const selectedIds = generated.events.map(e => e.id);
      await supabaseAdmin
        .from('events')
        .update({ last_used: todayStr })
        .in('id', selectedIds);

      puzzle = {
        date: generated.date,
        events: generated.events,
        answer_order: generated.answerOrder
      };
    }

    if (!puzzle) {
      return res.status(503).json({ error: 'Puzzle not yet available' });
    }

    // Check for authenticated user progress
    let progress = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7);
      const userClient = createUserClient(jwt);
      const { data: { user } } = await userClient.auth.getUser();

      if (user) {
        const { data: userProg } = await userClient
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('puzzle_date', todayStr)
          .single();

        if (userProg) {
          progress = {
            triesUsed: userProg.tries_used,
            order: userProg.order_attempted,
            finished: userProg.won || userProg.tries_used >= 3,
            won: userProg.won
          };
        }
      }
    }

    // Strip date fields so the answer isn't leaked to the client
    const safeEvents = puzzle.events.map(({ year, month, day, ...rest }) => rest);

    return res.status(200).json({
      puzzle: {
        date: puzzle.date,
        events: safeEvents
      },
      progress
    });
  } catch (err) {
    console.error('Error in /api/today:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
