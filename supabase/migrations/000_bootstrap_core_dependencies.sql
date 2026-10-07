-- Canonical schema bootstrap.
-- This migration intentionally creates only extensions. All application tables,
-- fields, triggers, policies and RPCs are defined once in 000_canonical_schema.sql.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
