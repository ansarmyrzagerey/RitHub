-- Remove the old global unique constraint that prevents per-study quiz attempts
-- This constraint was preventing users from taking the same quiz in different studies
-- The newer idx_quiz_attempts_unique_study_attempt index already handles per-study uniqueness

-- Drop the old global unique index
DROP INDEX IF EXISTS idx_quiz_attempts_unique;

-- Note: The partial unique index idx_quiz_attempts_unique_study_attempt 
-- (on quiz_id, user_id, study_id WHERE study_id IS NOT NULL) 
-- already exists and properly handles per-study quiz attempts
