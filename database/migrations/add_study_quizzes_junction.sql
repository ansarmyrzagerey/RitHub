-- Migration: Add study_quizzes junction table for many-to-many relationship
-- This allows quizzes to be assigned to multiple studies

-- Create the junction table
CREATE TABLE IF NOT EXISTS study_quizzes (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, quiz_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_study_quizzes_study ON study_quizzes(study_id);
CREATE INDEX IF NOT EXISTS idx_study_quizzes_quiz ON study_quizzes(quiz_id);

-- Migrate existing quiz-study relationships from quizzes.study_id to junction table
INSERT INTO study_quizzes (study_id, quiz_id)
SELECT study_id, id FROM quizzes 
WHERE study_id IS NOT NULL
ON CONFLICT (study_id, quiz_id) DO NOTHING;

-- Add missing columns that may be required by the application
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP NULL;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add study_id to quiz_attempts for per-study quiz attempts (allows retaking quiz for different studies)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS study_id INTEGER REFERENCES studies(id) ON DELETE SET NULL;

-- Note: We keep the study_id column in quizzes table for backward compatibility
-- but it will no longer be the primary source of truth for quiz-study relationships
