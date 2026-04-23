-- Migration: Add deadline notifications tracking table
-- This table tracks which participants have been notified at each deadline threshold

CREATE TABLE IF NOT EXISTS study_deadline_notifications (
  id SERIAL PRIMARY KEY,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(10) NOT NULL CHECK (notification_type IN ('24h', '1h')),
  notification_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(study_id, participant_id, notification_type)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_deadline_notifications_study_id ON study_deadline_notifications(study_id);
CREATE INDEX IF NOT EXISTS idx_deadline_notifications_participant_id ON study_deadline_notifications(participant_id);
CREATE INDEX IF NOT EXISTS idx_deadline_notifications_type ON study_deadline_notifications(notification_type);

-- Add comment
COMMENT ON TABLE study_deadline_notifications IS 'Tracks which participants have been notified about approaching study deadlines to prevent duplicate notifications';
