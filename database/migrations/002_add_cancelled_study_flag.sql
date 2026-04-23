-- Migration: Add cancelled study flag to evaluations
-- This ensures evaluation data is preserved and marked when a study is cancelled

-- Add flag to evaluations table to mark data from cancelled studies
ALTER TABLE evaluations 
ADD COLUMN from_cancelled_study BOOLEAN DEFAULT false;

-- Add index for querying evaluations from cancelled studies
CREATE INDEX idx_evaluations_cancelled_study ON evaluations(from_cancelled_study);

-- Add comment to document the purpose
COMMENT ON COLUMN evaluations.from_cancelled_study IS 'Indicates if this evaluation data is from a cancelled study and should be preserved';
