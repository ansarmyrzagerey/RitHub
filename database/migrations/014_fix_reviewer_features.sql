-- Migration: Fix reviewer features and add reflagged column
-- This migration ensures reviewer functionality works correctly

-- 1. Fix reviewer_assignments unique constraint to allow multiple reviewers per study
DROP INDEX IF EXISTS ux_reviewer_assignments_study;
CREATE UNIQUE INDEX IF NOT EXISTS ux_reviewer_study ON reviewer_assignments (study_id, reviewer_id);

-- 2. Add reflagged column to evaluations table
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS reflagged BOOLEAN DEFAULT false;

-- 3. Ensure notifications table exists (it should already exist from earlier migrations)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- Add index on user_id for faster notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
