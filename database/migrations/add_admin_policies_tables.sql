-- Migration: Add admin policy tables for US 2.7
-- This creates tables for file type restrictions and storage quotas

-- Admin policies for file type restrictions
CREATE TABLE IF NOT EXISTS admin_file_policies (
    id SERIAL PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL,
    policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('global', 'user', 'project')),
    target_id INTEGER NULL, -- user_id for user policies, project_id for project policies, NULL for global
    allowed_file_types TEXT[] NOT NULL, -- Array of allowed extensions like ['.java', '.py', '.md']
    max_file_size BIGINT DEFAULT 52428800, -- Max file size in bytes (default 50MB)
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Storage quotas per user or project
CREATE TABLE IF NOT EXISTS storage_quotas (
    id SERIAL PRIMARY KEY,
    quota_type VARCHAR(50) NOT NULL CHECK (quota_type IN ('user', 'project', 'global')),
    target_id INTEGER NULL, -- user_id for user quotas, project_id for project quotas, NULL for global
    max_storage_bytes BIGINT NOT NULL, -- Maximum storage in bytes
    current_usage_bytes BIGINT DEFAULT 0, -- Current usage in bytes
    max_artifacts INTEGER DEFAULT NULL, -- Maximum number of artifacts (optional)
    current_artifact_count INTEGER DEFAULT 0, -- Current artifact count
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(quota_type, target_id) -- Prevent duplicate quotas for same target
);

-- Storage usage tracking (for detailed analytics)
CREATE TABLE IF NOT EXISTS storage_usage_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('upload', 'delete', 'update')),
    size_change BIGINT NOT NULL, -- Positive for additions, negative for deletions
    total_usage_after BIGINT NOT NULL, -- Total usage after this action
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Policy violations log
CREATE TABLE IF NOT EXISTS policy_violations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    violation_type VARCHAR(100) NOT NULL, -- 'file_type', 'file_size', 'storage_quota', 'artifact_count'
    policy_id INTEGER NULL, -- Reference to the violated policy
    attempted_action TEXT, -- Description of what was attempted
    file_name VARCHAR(255),
    file_size BIGINT,
    file_type VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_policies_type_target ON admin_file_policies(policy_type, target_id);
CREATE INDEX IF NOT EXISTS idx_file_policies_active ON admin_file_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_storage_quotas_type_target ON storage_quotas(quota_type, target_id);
CREATE INDEX IF NOT EXISTS idx_storage_quotas_active ON storage_quotas(is_active);
CREATE INDEX IF NOT EXISTS idx_usage_history_user ON storage_usage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_created ON storage_usage_history(created_at);
CREATE INDEX IF NOT EXISTS idx_violations_user ON policy_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_violations_type ON policy_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_violations_created ON policy_violations(created_at);

-- Insert default global policies
-- Commented out: Auto-creation of file policies removed per user request
-- Admins can create file policies manually through the admin dashboard
/*
INSERT INTO admin_file_policies (policy_name, policy_type, target_id, allowed_file_types, max_file_size, created_by)
VALUES (
    'Default Global Policy',
    'global',
    NULL,
    ARRAY['.java', '.py', '.md', '.txt', '.pdf', '.uml', '.json', '.xml', '.csv'],
    52428800, -- 50MB
    1 -- Assuming admin user has ID 1, will be updated by actual admin
) ON CONFLICT DO NOTHING;
*/


-- Insert default global storage quota (10GB per user)
INSERT INTO storage_quotas (quota_type, target_id, max_storage_bytes, max_artifacts, created_by)
VALUES (
    'global',
    NULL,
    10737418240, -- 10GB default
    1000, -- 1000 artifacts max per user
    1 -- Assuming admin user has ID 1
) ON CONFLICT DO NOTHING;