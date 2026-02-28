-- Migration: add custom_rules column to users table
-- Run this on your production database (Supabase SQL editor)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "custom_rules" TEXT;
