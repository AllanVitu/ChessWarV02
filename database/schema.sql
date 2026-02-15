CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  rating INTEGER NOT NULL,
  motto TEXT NOT NULL,
  location TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  progress INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent TEXT NOT NULL,
  result TEXT NOT NULL,
  opening TEXT NOT NULL,
  date TEXT NOT NULL,
  moves INTEGER NOT NULL,
  accuracy INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  opponent TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  elo_delta INTEGER,
  created_at TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_move TEXT NOT NULL,
  time_control TEXT NOT NULL,
  side TEXT NOT NULL,
  difficulty TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  recipient_seen_at TIMESTAMPTZ,
  CHECK (requester_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS match_invites (
  id UUID PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  requester_side TEXT NOT NULL,
  recipient_side TEXT NOT NULL,
  time_control TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  requester_seen_at TIMESTAMPTZ,
  recipient_seen_at TIMESTAMPTZ,
  CHECK (requester_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS match_rooms (
  match_id UUID PRIMARY KEY,
  white_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  black_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  start_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  aborted_at TIMESTAMPTZ,
  white_ready_at TIMESTAMPTZ,
  black_ready_at TIMESTAMPTZ,
  white_seen_at TIMESTAMPTZ,
  black_seen_at TIMESTAMPTZ,
  side_to_move TEXT NOT NULL DEFAULT 'white',
  last_move TEXT NOT NULL DEFAULT '-',
  move_count INTEGER NOT NULL DEFAULT 0,
  CHECK (white_id <> black_id)
);

CREATE TABLE IF NOT EXISTS match_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  time_control TEXT NOT NULL,
  side_preference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_moves (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES match_rooms(match_id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  side TEXT NOT NULL,
  from_square TEXT NOT NULL,
  to_square TEXT NOT NULL,
  promotion TEXT,
  notation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, ply)
);

CREATE TABLE IF NOT EXISTS match_messages (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES match_rooms(match_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient ON friend_requests(recipient_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_friend_requests_pair ON friend_requests(requester_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_match_invites_requester ON match_invites(requester_id);
CREATE INDEX IF NOT EXISTS idx_match_invites_recipient ON match_invites(recipient_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_match_invites_pair ON match_invites(requester_id, recipient_id, match_id);
CREATE INDEX IF NOT EXISTS idx_match_rooms_white ON match_rooms(white_id);
CREATE INDEX IF NOT EXISTS idx_match_rooms_black ON match_rooms(black_id);
CREATE INDEX IF NOT EXISTS idx_match_rooms_status ON match_rooms(status);
CREATE INDEX IF NOT EXISTS idx_match_queue_mode ON match_queue(mode);
CREATE INDEX IF NOT EXISTS idx_match_queue_created ON match_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_match_moves_match ON match_moves(match_id);
CREATE INDEX IF NOT EXISTS idx_match_messages_match ON match_messages(match_id);
