-- Migration: Add soft delete functionality to artifacts
-- This migration adds columns to support soft deletion of artifacts
-- Required by the artifact model for tracking deleted artifacts

-- Add soft delete flag
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Add timestamp for when artifact was deleted
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add index for querying non-deleted artifacts (most common query)
CREATE INDEX IF NOT EXISTS idx_artifacts_is_deleted ON artifacts(is_deleted) WHERE is_deleted = false;

-- Add index for querying deleted artifacts by deletion date
CREATE INDEX IF NOT EXISTS idx_artifacts_deleted_at ON artifacts(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN artifacts.is_deleted IS 'Flag indicating if the artifact has been soft-deleted';
COMMENT ON COLUMN artifacts.deleted_at IS 'Timestamp when the artifact was deleted (NULL if not deleted)';
