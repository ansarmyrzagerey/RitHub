-- Add answer_type and answer_options columns to evaluation_tasks table
-- These columns are used to configure how participants should answer tasks

ALTER TABLE evaluation_tasks
  ADD COLUMN IF NOT EXISTS answer_type VARCHAR(50) DEFAULT 'rating',
  ADD COLUMN IF NOT EXISTS answer_options JSONB NULL;

-- Add comment for documentation
COMMENT ON COLUMN evaluation_tasks.answer_type IS 'Type of answer expected: rating, multiple_choice, text, rating_and_choice, etc.';
COMMENT ON COLUMN evaluation_tasks.answer_options IS 'JSON configuration for answer options (e.g., multiple choice options, rating scales)';


