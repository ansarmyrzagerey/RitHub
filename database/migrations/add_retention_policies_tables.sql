-- Migration: Add retention policy tables for US 2.8
-- This creates tables for retention policies, soft deletion, and audit logging

-- Retention policies configuration
CREATE TABLE IF NOT EXISTS retention_policies (
    id SERIAL PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL,
    policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('global', 'user', 'artifact_type')),
    target_id INTEGER NULL, -- user_id for user policies, NULL for global
    target_artifact_type VARCHAR(100) NULL, -- artifact type for type-specific policies
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),
    auto_delete BOOLEAN DEFAULT true, -- whether to automatically delete after retention
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Soft-deleted artifacts (archive before permanent deletion)
CREATE TABLE IF NOT EXISTS deleted_artifacts (
    id SERIAL PRIMARY KEY,
    original_artifact_id INTEGER NOT NULL, -- reference to original artifact
    artifact_data JSONB NOT NULL, -- complete artifact data as JSON
    file_data BYTEA, -- actual file content if stored in database
    file_path VARCHAR(500), -- original file path if stored on filesystem
    deleted_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deletion_reason VARCHAR(500),
    scheduled_purge_at TIMESTAMP NOT NULL, -- when this should be permanently deleted
    is_restored BOOLEAN DEFAULT false,
    restored_by INTEGER REFERENCES users(id),
    restored_at TIMESTAMP,
    retention_policy_id INTEGER REFERENCES retention_policies(id)
);

-- Audit log for retention and deletion operations
CREATE TABLE IF NOT EXISTS retention_audit_log (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(50) NOT NULL CHECK (operation IN ('soft_delete', 'restore', 'permanent_delete', 'policy_applied')),
    artifact_id INTEGER, -- original artifact ID
    deleted_artifact_id INTEGER REFERENCES deleted_artifacts(id),
    user_id INTEGER REFERENCES users(id), -- who performed the action
    policy_id INTEGER REFERENCES retention_policies(id), -- which policy was applied
    operation_data JSONB, -- additional operation details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled cleanup jobs tracking
CREATE TABLE IF NOT EXISTS cleanup_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('retention_cleanup', 'storage_cleanup')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    processed_count INTEGER DEFAULT 0,
    deleted_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    error_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_retention_policies_type_target ON retention_policies(policy_type, target_id);
CREATE INDEX IF NOT EXISTS idx_retention_policies_active ON retention_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_deleted_artifacts_original ON deleted_artifacts(original_artifact_id);
CREATE INDEX IF NOT EXISTS idx_deleted_artifacts_purge_date ON deleted_artifacts(scheduled_purge_at);
CREATE INDEX IF NOT EXISTS idx_deleted_artifacts_deleted_by ON deleted_artifacts(deleted_by);
CREATE INDEX IF NOT EXISTS idx_deleted_artifacts_restored ON deleted_artifacts(is_restored);
CREATE INDEX IF NOT EXISTS idx_audit_log_artifact ON retention_audit_log(artifact_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON retention_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON retention_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_cleanup_jobs_status ON cleanup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cleanup_jobs_type ON cleanup_jobs(job_type);

-- Add soft deletion columns to existing artifacts table
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- Index for soft deletion queries
CREATE INDEX IF NOT EXISTS idx_artifacts_deleted ON artifacts(is_deleted);
CREATE INDEX IF NOT EXISTS idx_artifacts_deleted_at ON artifacts(deleted_at) WHERE deleted_at IS NOT NULL;

-- Insert default global retention policy (90 days)
INSERT INTO retention_policies (policy_name, policy_type, target_id, retention_days, created_by)
VALUES (
    'Default Global Retention',
    'global',
    NULL,
    90, -- 90 days default retention
    1 -- Will be updated by actual admin user
) ON CONFLICT DO NOTHING;