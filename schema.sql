-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table: all historical events from the period JSON files
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER,
  day INTEGER,
  text TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN (
    'precolonial',
    'spanish',
    'revolution-american',
    'postwar',
    'marcos-edsa',
    'contemporary-early',
    'contemporary-modern'
  )),
  image_url TEXT,
  image_local TEXT,
  source_text TEXT,
  source_url TEXT,
  last_used DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily puzzles table: pre-generated puzzle for each date
CREATE TABLE IF NOT EXISTS daily_puzzles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE UNIQUE NOT NULL,
  events JSONB NOT NULL,
  answer_order UUID[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User stats table (synced with Supabase Auth)
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  last_completed DATE,
  last_played DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User progress table (per-day play history)
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  puzzle_date DATE NOT NULL,
  won BOOLEAN NOT NULL DEFAULT FALSE,
  tries_used INTEGER NOT NULL DEFAULT 0,
  order_attempted UUID[] NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, puzzle_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_period ON events(period);
CREATE INDEX IF NOT EXISTS idx_events_last_used ON events(last_used);
CREATE INDEX IF NOT EXISTS idx_daily_puzzles_date ON daily_puzzles(date);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_date ON user_progress(puzzle_date);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies: events are publicly readable
CREATE POLICY "Events are publicly readable" ON events
  FOR SELECT USING (true);

-- RLS Policies: daily_puzzles are publicly readable
CREATE POLICY "Daily puzzles are publicly readable" ON daily_puzzles
  FOR SELECT USING (true);

-- RLS Policies: user_stats - users can only access their own row
CREATE POLICY "Users can read own stats" ON user_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats" ON user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON user_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies: user_progress - users can only access their own rows
CREATE POLICY "Users can read own progress" ON user_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON user_progress
  FOR UPDATE USING (auth.uid() = user_id);
