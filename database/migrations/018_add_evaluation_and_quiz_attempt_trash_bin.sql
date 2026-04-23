-- Add trash bin support for evaluations and quiz attempts
-- Migration: Add deleted_at and deleted_by columns for soft deletion

-- Add columns to evaluations table for soft deletion
ALTER TABLE evaluations 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- Add columns to quiz_attempts table for soft deletion
ALTER TABLE quiz_attempts 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- Add indexes for efficient querying of deleted items
CREATE INDEX IF NOT EXISTS idx_evaluations_deleted_at ON evaluations(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_deleted_at ON quiz_attempts(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add comments to document the deletion workflow
COMMENT ON COLUMN evaluations.deleted_at IS 'Timestamp when evaluation was moved to trash bin. NULL means not deleted.';
COMMENT ON COLUMN evaluations.deleted_by IS 'User ID who moved the evaluation to trash bin.';
COMMENT ON COLUMN quiz_attempts.deleted_at IS 'Timestamp when quiz attempt was moved to trash bin. NULL means not deleted.';
COMMENT ON COLUMN quiz_attempts.deleted_by IS 'User ID who moved the quiz attempt to trash bin.';


