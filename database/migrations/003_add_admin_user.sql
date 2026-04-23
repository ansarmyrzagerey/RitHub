-- Migration: Add Default Admin User
-- Description: Creates a default admin user account for fresh installations
-- Admin credentials are read from environment variables:
--   ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD
-- See .env.example for placeholder values.

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Read credentials from psql variables passed via -v flags from run-migrations.sh.
-- The password is hashed using pgcrypto's crypt() with a bcrypt (bf) salt.
-- Fallbacks are provided for backward compatibility.

INSERT INTO users (
  email,
  username,
  password_hash,
  first_name,
  last_name,
  organization,
  role,
  is_verified,
  created_at,
  updated_at
) VALUES (
  COALESCE(NULLIF(:'admin_email', ''), 'admin@rithub.com'),
  COALESCE(NULLIF(:'admin_username', ''), 'admin'),
  crypt(
    COALESCE(NULLIF(:'admin_password', ''), 'Admin@2024'),
    gen_salt('bf', 10)
  ),
  'Platform',
  'Administrator',
  'RitHub',
  'admin',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;

-- Verify admin user was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '  Default Admin User Created';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Credentials configured via ADMIN_USERNAME / ADMIN_PASSWORD env vars';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Change this password after first login!';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE 'Admin user already exists or creation was skipped';
  END IF;
END $$;
