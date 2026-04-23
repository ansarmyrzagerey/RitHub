-- Fix users role constraint to include 'reviewer'
-- This migration adds 'reviewer' to the allowed roles

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the updated constraint with all allowed roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('researcher', 'participant', 'admin', 'reviewer'));