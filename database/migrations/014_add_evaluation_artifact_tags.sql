-- Migration: Add evaluation_artifact_tags table
-- This allows participants to add up to 5 tags to each artifact during evaluation

CREATE TABLE IF NOT EXISTS evaluation_artifact_tags (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    artifact_id INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, participant_id, artifact_id, tag)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_eval_artifact_tags_task ON evaluation_artifact_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_eval_artifact_tags_participant ON evaluation_artifact_tags(participant_id);
CREATE INDEX IF NOT EXISTS idx_eval_artifact_tags_artifact ON evaluation_artifact_tags(artifact_id);
CREATE INDEX IF NOT EXISTS idx_eval_artifact_tags_composite ON evaluation_artifact_tags(task_id, participant_id, artifact_id);

-- Add constraint to limit tags per artifact per evaluation to 5
-- This is enforced at the application level, but we add a comment for documentation
COMMENT ON TABLE evaluation_artifact_tags IS 'Stores tags added by participants to artifacts during evaluation. Maximum 5 tags per artifact per evaluation.';
COMMENT ON COLUMN evaluation_artifact_tags.tag IS 'Tag name (up to 100 characters)';



