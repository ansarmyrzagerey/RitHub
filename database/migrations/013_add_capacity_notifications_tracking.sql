-- Migration: Add capacity notifications tracking table
-- This table tracks when capacity notifications have been sent to prevent duplicates

CREATE TABLE IF NOT EXISTS study_capacity_notifications (
  id SERIAL PRIMARY KEY,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  notification_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  enrolled_count INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  percent_filled INTEGER NOT NULL,
  UNIQUE(study_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_capacity_notifications_study_id ON study_capacity_notifications(study_id);

-- Add comment
COMMENT ON TABLE study_capacity_notifications IS 'Tracks when capacity notifications have been sent to researchers to prevent duplicate notifications';
