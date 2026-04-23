-- Migration: Add trash bin support for participant-completed studies
-- This allows participants to hide completed studies from their view while preserving data for researchers

-- Add columns to study_participants table for soft deletion
ALTER TABLE study_participants 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- Add index for efficient querying of deleted participant-study relationships
CREATE INDEX IF NOT EXISTS idx_study_participants_deleted_at ON study_participants(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add comments to document the deletion workflow
COMMENT ON COLUMN study_participants.deleted_at IS 'Timestamp when participant deleted their view of this completed study. NULL means not deleted. Evaluations remain in database for researchers.';
COMMENT ON COLUMN study_participants.deleted_by IS 'User ID (participant) who deleted their view of this study.';


