-- Migration: Add missing columns to evaluation_tasks table
-- This migration adds the answer_type and answer_options columns that are required by the TaskGenerationService

-- Add answer_type column
ALTER TABLE evaluation_tasks 
ADD COLUMN IF NOT EXISTS answer_type VARCHAR(50);

-- Add answer_options column (JSON data for storing answer configuration)
ALTER TABLE evaluation_tasks 
ADD COLUMN IF NOT EXISTS answer_options JSONB;

-- Update existing records to have default values (if any exist)
UPDATE evaluation_tasks 
SET answer_type = 'choice_required_text', 
    answer_options = '{}'::jsonb 
WHERE answer_type IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN evaluation_tasks.answer_type IS 'Type of answer expected (choice_required_text, rating, etc.)';
COMMENT ON COLUMN evaluation_tasks.answer_options IS 'JSON configuration for answer options and criteria';