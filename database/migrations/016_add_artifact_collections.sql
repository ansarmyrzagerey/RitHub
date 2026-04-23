-- Migration: Add artifact collections support
-- Purpose: Group artifacts from bulk imports into named collections

-- Create artifact_collections table
CREATE TABLE IF NOT EXISTS artifact_collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    import_source VARCHAR(50), -- 'zip', 'csv', 'json', 'manual'
    file_count INTEGER DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add collection_id to artifacts table
ALTER TABLE artifacts 
ADD COLUMN IF NOT EXISTS collection_id INTEGER REFERENCES artifact_collections(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_artifacts_collection_id ON artifacts(collection_id);
CREATE INDEX IF NOT EXISTS idx_collections_created_by ON artifact_collections(created_by);
CREATE INDEX IF NOT EXISTS idx_collections_created_at ON artifact_collections(created_at DESC);

-- Add trigger to update collection stats
CREATE OR REPLACE FUNCTION update_collection_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update collection file count and total size
        UPDATE artifact_collections
        SET 
            file_count = (
                SELECT COUNT(*) 
                FROM artifacts 
                WHERE collection_id = NEW.collection_id
            ),
            total_size = (
                SELECT COALESCE(SUM(file_size), 0)
                FROM artifacts
                WHERE collection_id = NEW.collection_id
            ),
            updated_at = NOW()
        WHERE id = NEW.collection_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        -- Update collection stats after deletion
        UPDATE artifact_collections
        SET 
            file_count = (
                SELECT COUNT(*) 
                FROM artifacts 
                WHERE collection_id = OLD.collection_id
            ),
            total_size = (
                SELECT COALESCE(SUM(file_size), 0)
                FROM artifacts
                WHERE collection_id = OLD.collection_id
            ),
            updated_at = NOW()
        WHERE id = OLD.collection_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_collection_stats ON artifacts;
CREATE TRIGGER trigger_update_collection_stats
AFTER INSERT OR UPDATE OF collection_id, file_size OR DELETE ON artifacts
FOR EACH ROW
EXECUTE FUNCTION update_collection_stats();

-- Add comment
COMMENT ON TABLE artifact_collections IS 'Groups of artifacts from bulk imports or manual organization';
COMMENT ON COLUMN artifact_collections.import_source IS 'Source of the collection: zip, csv, json, or manual';
COMMENT ON COLUMN artifact_collections.file_count IS 'Auto-updated count of artifacts in collection';
COMMENT ON COLUMN artifact_collections.total_size IS 'Auto-updated total size of all artifacts in bytes';
