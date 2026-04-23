-- Migration: Add question_type to study_questions
-- This adds support for different question types: comparison (2-3 artifacts) and rating (1 artifact)

-- Add question_type column
ALTER TABLE study_questions 
ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) NOT NULL DEFAULT 'comparison' 
CHECK (question_type IN ('comparison', 'rating'));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_study_questions_type ON study_questions(question_type);

-- Add comment to document the purpose
COMMENT ON COLUMN study_questions.question_type IS 'Type of question: comparison (2-3 artifacts) or rating (1 artifact)';
