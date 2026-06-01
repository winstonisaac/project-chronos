import { supabase, createUserClient } from '../lib/supabase.js';
import { getManilaDateStr, subtractDaysManila } from '../lib/time.js';

const MAX_TRIES = 3;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order, tryNumber } = req.body;
    if (!Array.isArray(order) || order.length !== 7) {
      return res.status(400).json({ error: 'Invalid order: must be an array of 7 event IDs' });
    }
    if (typeof tryNumber !== 'number' || tryNumber < 1 || tryNumber > MAX_TRIES) {
      return res.status(400).json({ error: 'Invalid tryNumber' });
    }

    const todayStr = getManilaDateStr();

    // Fetch today's puzzle answer
    const { data: puzzle, error: puzzleError } = await supabase
      .from('daily_puzzles')
      .select('answer_order, events')
      .eq('date', todayStr)
      .single();

    if (puzzleError || !puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    const answer = puzzle.answer_order;
    const eventMap = new Map(puzzle.events.map(e => [e.id, e]));
    const answerEvents = answer.map(id => eventMap.get(id)).filter(Boolean);

    // Validate answer
    const correctPositions = [];
    const isCorrect = order.map((id, i) => {
      const correct = id === answer[i];
      if (correct) correctPositions.push(i);
      return correct;
    });

    const won = isCorrect.every(Boolean);
    const gameOver = won || tryNumber >= MAX_TRIES;

    // Persist for authenticated users
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7);
      const userClient = createUserClient(jwt);
      const { data: { user } } = await userClient.auth.getUser();

      if (user) {
        // Upsert progress
        await userClient
          .from('user_progress')
          .upsert({
            user_id: user.id,
            puzzle_date: todayStr,
            tries_used: tryNumber,
            order_attempted: order,
            won: won,
            completed_at: gameOver ? new Date().toISOString() : null
          }, { onConflict: 'user_id,puzzle_date' });

        // Update stats if game is over
        if (gameOver) {
          const { data: stats } = await userClient
            .from('user_stats')
            .select('*')
            .eq('user_id', user.id)
            .single();

          let gamesPlayed = (stats?.games_played || 0) + 1;
          let gamesWon = stats?.games_won || 0;
          let currentStreak = 0;
          let maxStreak = stats?.max_streak || 0;
          let lastCompleted = stats?.last_completed || null;

          if (won) {
            gamesWon += 1;
            const yesterdayStr = subtractDaysManila(1);
            if (lastCompleted === yesterdayStr) {
              currentStreak = (stats?.current_streak || 0) + 1;
            } else {
              currentStreak = 1;
            }
            maxStreak = Math.max(maxStreak, currentStreak);
            lastCompleted = todayStr;
          } else {
            currentStreak = 0;
          }

          await userClient
            .from('user_stats')
            .upsert({
              user_id: user.id,
              games_played: gamesPlayed,
              games_won: gamesWon,
              current_streak: currentStreak,
              max_streak: maxStreak,
              last_completed: lastCompleted,
              last_played: todayStr,
              updated_at: new Date().toISOString()
            });
        }
      }
    }

    return res.status(200).json({
      correctPositions,
      isCorrect,
      won,
      gameOver,
      answerOrder: gameOver ? answer : undefined,
      answerEvents: gameOver ? answerEvents : undefined
    });
  } catch (err) {
    console.error('Error in /api/submit:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
