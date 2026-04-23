-- Add unique index to ensure one attempt per user per quiz per study
-- This prevents race conditions where a user might submit the same quiz multiple times for the same study

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_unique_study_attempt 
ON quiz_attempts (quiz_id, user_id, study_id) 
WHERE study_id IS NOT NULL;

-- Also verify we don't have duplicates already before applying (cleanup if needed)
-- Note: This is a safe operations script, actual cleanup might require manual intervention if duplicates exist
-- For now we just add the index
