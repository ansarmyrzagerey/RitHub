-- Add user suspension support
-- This migration adds a suspended_until column to the users table
-- When suspended_until is set to a future timestamp, the user cannot sign in
-- When suspended_until is NULL or in the past, the user can sign in normally

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP NULL;

-- Create index for efficient queries on suspension status
CREATE INDEX IF NOT EXISTS idx_users_suspended_until ON users(suspended_until) WHERE suspended_until IS NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN users.suspended_until IS 'Timestamp until which the user account is suspended. NULL means not suspended. If set to a future date, user cannot sign in until that date.';


