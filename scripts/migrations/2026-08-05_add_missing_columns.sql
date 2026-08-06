-- Migration: Add missing/expanded columns for mobile API compatibility
-- Run this against the tenant database. Review before applying.
-- Date: 2026-08-05
-- Purpose: Fix mobile app database schema errors

-- BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT!

-- 1) Add created_by to complaints (track who submitted the complaint)
-- This column is used by mobile app to store the user ID who created the complaint
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NULL COMMENT 'User who created the complaint';

-- 2) Add option_selected to poll_votes (store selected option id/string)
-- This column stores which option the user selected in the poll
ALTER TABLE poll_votes
  ADD COLUMN IF NOT EXISTS option_selected VARCHAR(128) NULL COMMENT 'Selected option id/string';

-- 3) Update amenity_bookings.status to accept 'confirmed' status
-- Mobile app uses 'confirmed' status which wasn't in the ENUM
-- Change from ENUM to VARCHAR to allow more flexibility
ALTER TABLE amenity_bookings
  MODIFY COLUMN status VARCHAR(64) NULL DEFAULT 'pending' COMMENT 'Status: pending, approved, cancelled, completed, confirmed';

-- 4) Add 'general' category to complaints ENUM if using ENUM
-- Mobile app uses 'general' category
-- Note: If you're using VARCHAR instead of ENUM, skip this step
-- ALTER TABLE complaints
--   MODIFY COLUMN category ENUM('electrical','plumbing','security','cleaning','lift','water','civil','hvac','other','general') NOT NULL DEFAULT 'other';

-- Optional: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_complaints_created_by ON complaints(created_by);
CREATE INDEX IF NOT EXISTS idx_poll_votes_selected ON poll_votes(option_selected);

-- Verification Queries (uncomment to test):
-- DESCRIBE complaints;
-- DESCRIBE poll_votes;
-- DESCRIBE amenity_bookings;

-- Notes:
-- * Always backup your database before running migrations
-- * Test on a staging environment first
-- * If using MySQL 5.6 or earlier, replace "IF NOT EXISTS" with manual checks
