-- Migration: Add Default Admin User
-- Description: Creates a default admin user account for fresh installations
-- This makes first-time setup easier - change password after first login!

-- Insert default admin user
-- Email: admin@rithub.com
-- Username: admin
-- Password: Admin@2024
-- Password hash generated using bcrypt with 10 rounds
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
  'admin@rithub.com',
  'admin',
  '$2a$10$ApwLtlb54rN.l/kN2BTtru/tS7W9LPo2i.H3dnDKnq.JNAuumlHW2', -- Password: Admin@2024
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
  IF EXISTS (SELECT 1 FROM users WHERE email = 'admin@rithub.com' AND role = 'admin') THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '  Default Admin User Created';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Email/Username: admin@rithub.com or admin';
    RAISE NOTICE 'Password: Admin@2024';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Change this password after first login!';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE 'Admin user already exists or creation was skipped';
  END IF;
END $$;
