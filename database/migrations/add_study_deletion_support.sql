-- Add study deletion support with trash bin functionality
-- Migration: Add deleted status and tracking columns to studies table

-- Drop the existing check constraint and add new one with deleted status
ALTER TABLE studies DROP CONSTRAINT IF EXISTS studies_status_check;

-- Add the new constraint with deleted status
ALTER TABLE studies ADD CONSTRAINT studies_status_check 
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'archived', 'deleted'));

-- Add columns to track deletion metadata
ALTER TABLE studies 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50) NULL;

-- Add index for efficient querying of deleted studies
CREATE INDEX IF NOT EXISTS idx_studies_deleted_at ON studies(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_studies_status_deleted ON studies(status) WHERE status = 'deleted';

-- Create table to track study deletion operations for audit purposes
CREATE TABLE IF NOT EXISTS study_deletion_log (
    id SERIAL PRIMARY KEY,
    study_id INTEGER NOT NULL,
    operation VARCHAR(50) NOT NULL CHECK (operation IN ('soft_delete', 'restore', 'permanent_delete')),
    performed_by INTEGER REFERENCES users(id),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for the deletion log
CREATE INDEX IF NOT EXISTS idx_study_deletion_log_study ON study_deletion_log(study_id);
CREATE INDEX IF NOT EXISTS idx_study_deletion_log_operation ON study_deletion_log(operation);
CREATE INDEX IF NOT EXISTS idx_study_deletion_log_created_at ON study_deletion_log(created_at);

-- Add comment to document the deletion workflow
COMMENT ON COLUMN studies.deleted_at IS 'Timestamp when study was moved to trash bin. NULL means not deleted.';
COMMENT ON COLUMN studies.deleted_by IS 'User ID who moved the study to trash bin.';
COMMENT ON COLUMN studies.previous_status IS 'Status before deletion, used for restoration.';
COMMENT ON TABLE study_deletion_log IS 'Audit log for all study deletion operations including soft delete, restore, and permanent delete.';