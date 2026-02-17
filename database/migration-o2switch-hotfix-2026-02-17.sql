CREATE TABLE IF NOT EXISTS match_queue (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  time_control TEXT NOT NULL,
  side_preference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS aborted_at TIMESTAMPTZ;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS white_ready_at TIMESTAMPTZ;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS black_ready_at TIMESTAMPTZ;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS white_seen_at TIMESTAMPTZ;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS black_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_match_queue_mode ON match_queue(mode);
CREATE INDEX IF NOT EXISTS idx_match_queue_created ON match_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_match_queue_user ON match_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_match_rooms_status ON match_rooms(status);
