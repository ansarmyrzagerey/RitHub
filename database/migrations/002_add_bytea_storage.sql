-- Migration: Add BYTEA storage for artifacts
-- This allows storing file data directly in the database instead of the file system

-- Add columns for binary file storage
ALTER TABLE artifacts ADD COLUMN file_data BYTEA;
ALTER TABLE artifacts ADD COLUMN file_size BIGINT;
ALTER TABLE artifacts ADD COLUMN mime_type VARCHAR(255);
ALTER TABLE artifacts ADD COLUMN checksum VARCHAR(64);

-- Add index for file size queries (useful for analytics)
CREATE INDEX idx_artifacts_file_size ON artifacts(file_size) WHERE file_size IS NOT NULL;

-- Add index for mime type queries
CREATE INDEX idx_artifacts_mime_type ON artifacts(mime_type) WHERE mime_type IS NOT NULL;

-- Update the artifacts table to make file_path optional (for backward compatibility)
-- We'll keep both file_path and file_data columns during transition
-- file_path will be NULL for new BYTEA-stored artifacts
-- file_data will be NULL for existing file-system stored artifacts

-- Add a computed column to check storage type
ALTER TABLE artifacts ADD COLUMN storage_type VARCHAR(20) 
GENERATED ALWAYS AS (
    CASE 
        WHEN file_data IS NOT NULL THEN 'database'
        WHEN file_path IS NOT NULL THEN 'filesystem'
        ELSE 'none'
    END
) STORED;

-- Add constraint to ensure we have either file_path OR file_data (but not both)
ALTER TABLE artifacts ADD CONSTRAINT chk_storage_method 
CHECK (
    (file_path IS NOT NULL AND file_data IS NULL) OR 
    (file_path IS NULL AND file_data IS NOT NULL) OR
    (file_path IS NULL AND file_data IS NULL AND content IS NOT NULL)
);

-- Add comments for documentation
COMMENT ON COLUMN artifacts.file_data IS 'Binary file content stored in database';
COMMENT ON COLUMN artifacts.file_size IS 'Size of the file in bytes';
COMMENT ON COLUMN artifacts.mime_type IS 'MIME type of the file (e.g., text/plain, application/pdf)';
COMMENT ON COLUMN artifacts.checksum IS 'SHA-256 checksum for file integrity verification';
COMMENT ON COLUMN artifacts.storage_type IS 'Computed column indicating storage method: database, filesystem, or none';