-- BHEL VMS PostgreSQL Initialization Script
-- Run automatically by Docker on first startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fast text search

-- Seed default departments
INSERT INTO departments (department_code, department_name, description, floor, building, is_active)
VALUES
  ('ENG', 'Engineering', 'Engineering & Design Division', '2nd Floor', 'Block A', true),
  ('PWR', 'Power', 'Power Systems Division', '3rd Floor', 'Block B', true),
  ('MFG', 'Manufacturing', 'Manufacturing & Production', 'Ground Floor', 'Factory', true),
  ('QC', 'Quality Control', 'Quality Assurance', '1st Floor', 'Block A', true),
  ('HR', 'Human Resources', 'HR & Administration', '1st Floor', 'Admin Block', true),
  ('FIN', 'Finance', 'Finance & Accounts', '2nd Floor', 'Admin Block', true),
  ('IT', 'Information Technology', 'IT & Systems', 'Ground Floor', 'IT Block', true),
  ('SEC', 'Security', 'Security & Vigilance', 'Ground Floor', 'Gate House', true),
  ('RD', 'Research & Development', 'R&D Division', '4th Floor', 'Block C', true),
  ('MNTS', 'Maintenance', 'Plant Maintenance', 'Ground Floor', 'Factory', true),
  ('PUR', 'Purchase', 'Procurement & Purchase', '1st Floor', 'Block B', true),
  ('ADM', 'Administration', 'General Administration', '2nd Floor', 'Admin Block', true)
ON CONFLICT DO NOTHING;

-- Seed default admin user (password: Admin@BHEL2026 — change immediately!)
-- Hash generated with bcrypt rounds=12
INSERT INTO users (username, email, full_name, password_hash, role, is_active, is_verified)
VALUES (
  'admin',
  'admin@bhel-varanasi.com',
  'System Administrator',
  '$2b$12$LQv3c1yqBwEHFnZwGjA8UOh5MRY78xHEpKfY5LbCqnRWMbxb4NHqK',  -- Admin@BHEL2026
  'admin',
  true,
  true
),
(
  'security',
  'security@bhel-varanasi.com',
  'Security Officer',
  '$2b$12$LQv3c1yqBwEHFnZwGjA8UOh5MRY78xHEpKfY5LbCqnRWMbxb4NHqK',  -- Admin@BHEL2026
  'security_officer',
  true,
  true
),
(
  'reception',
  'reception@bhel-varanasi.com',
  'Receptionist',
  '$2b$12$LQv3c1yqBwEHFnZwGjA8UOh5MRY78xHEpKfY5LbCqnRWMbxb4NHqK',  -- Admin@BHEL2026
  'receptionist',
  true,
  true
)
ON CONFLICT (username) DO NOTHING;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_visitors_mobile ON visitors(mobile);
CREATE INDEX IF NOT EXISTS idx_visitors_name_trgm ON visitors USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);
CREATE INDEX IF NOT EXISTS idx_entry_exit_date ON entry_exit_logs(visit_date);
CREATE INDEX IF NOT EXISTS idx_entry_exit_active ON entry_exit_logs(is_active) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_entry_exit_year_month ON entry_exit_logs(visit_year, visit_month);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
