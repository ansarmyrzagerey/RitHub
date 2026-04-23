-- Add flagged column to evaluations table
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;
