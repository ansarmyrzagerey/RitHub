-- Add notifications and task progress tables, and start/end dates for studies
ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMP NULL;

-- Notifications table for users
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task progress table to track participant progress and time spent
CREATE TABLE IF NOT EXISTS task_progress (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
  participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  started_at TIMESTAMP NULL,
  time_spent_seconds INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_task ON task_progress(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_participant ON task_progress(participant_id);
