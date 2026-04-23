-- Migration: Add versioning and metrics support
-- This migration adds support for US 2.4 (versioned metadata) and US 2.10 (artifact metrics)

-- Artifact metadata versions table (for US 2.4)
CREATE TABLE IF NOT EXISTS artifact_metadata_versions (
    id SERIAL PRIMARY KEY,
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    metadata JSONB,
    edited_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artifact_id, version_number)
);

-- Artifact analysis metrics table (for US 2.10)
CREATE TABLE IF NOT EXISTS artifact_metrics (
    id SERIAL PRIMARY KEY,
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    metric_type VARCHAR(100) NOT NULL, -- 'complexity', 'lines_of_code', 'test_coverage', etc.
    metric_value DECIMAL(10,4),
    metric_data JSONB, -- additional metric details
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact ON artifact_metadata_versions(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_version ON artifact_metadata_versions(artifact_id, version_number);
CREATE INDEX IF NOT EXISTS idx_artifact_metrics_artifact ON artifact_metrics(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_metrics_type ON artifact_metrics(metric_type);

-- Populate initial versions for existing artifacts
INSERT INTO artifact_metadata_versions (artifact_id, version_number, name, type, metadata, edited_by)
SELECT 
    id as artifact_id,
    1 as version_number,
    name,
    type,
    metadata,
    uploaded_by as edited_by
FROM artifacts
WHERE id NOT IN (SELECT DISTINCT artifact_id FROM artifact_metadata_versions);

-- Add some sample metrics for demonstration (optional)
-- INSERT INTO artifact_metrics (artifact_id, metric_type, metric_value, metric_data)
-- SELECT 
--     id as artifact_id,
--     'file_size' as metric_type,
--     CASE 
--         WHEN (metadata->>'size')::integer IS NOT NULL THEN (metadata->>'size')::integer
--         ELSE 0
--     END as metric_value,
--     '{"unit": "bytes"}'::jsonb as metric_data
-- FROM artifacts
-- WHERE metadata->>'size' IS NOT NULL;