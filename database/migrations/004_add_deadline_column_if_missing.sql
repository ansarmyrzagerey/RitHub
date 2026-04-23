-- Migration: Add deadline column to studies table if it doesn't exist
-- This migration safely adds the deadline column without dropping the table

-- Check if deadline column exists, and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'studies' 
        AND column_name = 'deadline'
    ) THEN
        ALTER TABLE studies ADD COLUMN deadline TIMESTAMP;
        CREATE INDEX IF NOT EXISTS idx_studies_deadline ON studies(deadline);
        RAISE NOTICE 'Added deadline column to studies table';
    ELSE
        RAISE NOTICE 'deadline column already exists in studies table';
    END IF;
END $$;


