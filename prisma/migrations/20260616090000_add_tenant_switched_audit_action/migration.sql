-- Add audit action for explicit tenant/workspace session switching.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TENANT_SWITCHED';
