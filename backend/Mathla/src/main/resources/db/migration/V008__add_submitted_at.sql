-- V008__add_submitted_at.sql
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
