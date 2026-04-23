-- Migration: Add quiz requirements to studies
-- This allows studies to require participants to pass a quiz before accessing study questions

-- Add quiz_id column to studies table to link a required quiz
ALTER TABLE studies 
ADD COLUMN IF NOT EXISTS required_quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_studies_required_quiz ON studies(required_quiz_id);

-- Add comment for documentation
COMMENT ON COLUMN studies.required_quiz_id IS 'Optional quiz that participants must pass to access study questions. Passing the quiz awards a badge that grants access.';
