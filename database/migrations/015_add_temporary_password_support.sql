-- Migration 015: Add temporary password support for forgot password functionality
-- This migration adds columns to support temporary passwords and password reset functionality

-- Add columns for temporary password functionality
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS temp_password_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN DEFAULT false;

-- Create index for efficient lookup of expired temporary passwords
CREATE INDEX IF NOT EXISTS idx_users_temp_password_expires 
ON users(temp_password_expires) 
WHERE temp_password_expires IS NOT NULL;

-- Add comment to document the new columns
COMMENT ON COLUMN users.temp_password_expires IS 'Expiration timestamp for temporary passwords generated during password reset';
COMMENT ON COLUMN users.requires_password_change IS 'Flag indicating if user must change password on next login (used with temporary passwords)';