import { createUserClient } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const jwt = authHeader.slice(7);
    const userClient = createUserClient(jwt);
    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: stats, error: statsError } = await userClient
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (statsError && statsError.code !== 'PGRST116') {
      console.error('Stats fetch error:', statsError);
    }

    const { data: history } = await userClient
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('puzzle_date', { ascending: false })
      .limit(30);

    return res.status(200).json({
      stats: stats || {
        games_played: 0,
        games_won: 0,
        current_streak: 0,
        max_streak: 0
      },
      history: history || []
    });
  } catch (err) {
    console.error('Error in /api/stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
