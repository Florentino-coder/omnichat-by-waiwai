# Cloudflare R2 Storage & Database Backup Guide

This document describes how to configure, monitor, and restore the Cloudflare R2 storage and database backup systems for Chat-Wai SaaS.

---

## 1. Cloudflare R2 Bucket Configuration

You must create two separate R2 buckets in your Cloudflare dashboard:

1. **`chatwai-storage`**: Used for outbound/agent-uploaded media, voice messages, videos, company logos, and avatars. **Inbound LINE chat images are not stored here** — they are proxied on demand from the LINE Content API.
2. **`chatwai-backups`**: Used **only** for automated PostgreSQL SQL dumps (daily/weekly/monthly/manual).

### Step-by-Step Setup:
1. Log in to your **Cloudflare Dashboard**.
2. Click **R2 Object Storage** in the sidebar.
3. Click **Create bucket**. Name the first one `chatwai-storage` and the second `chatwai-backups`. Use default options (e.g. standard location).
4. On the R2 overview page, click **Manage R2 API Tokens** on the right side.
5. Click **Create API token**:
   - Name: `Chat-Wai API Token`
   - Permissions: **Edit** (Read & Write)
   - Scope: Apply to all buckets or target specific buckets.
   - Click **Create Token**.
6. Copy the following values to your environment secrets manager (e.g., Render or Coolify):
   - **Account ID** (found on the R2 overview page or token page)
   - **Access Key ID**
   - **Secret Access Key**

---

## 2. Environment Variables

Add the following environment variables to your production backend (.env / Coolify Secrets):

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-access-key-id"
R2_SECRET_ACCESS_KEY="your-secret-access-key"
R2_BUCKET_STORAGE="chatwai-storage"
R2_BUCKET_BACKUPS="chatwai-backups"
R2_PUBLIC_URL="https://pub-your-id.r2.dev" # Optional (Cloudflare custom domain or public R2 URL)
```

---

## 3. Storage Retention & Cleanup Policies

To maintain optimal storage costs near zero, temporary file objects are automatically cleaned up.

| Class | Key Format | Auto-Delete |
|-------|------------|-------------|
| **Permanent** | `permanent/{tenantId}/{fileType}/{yyyy}/{mm}/{dd}/{uuid}-{name}` | ❌ Never |
| **Temporary** | `temporary/{tenantId}/{fileType}/{yyyy}/{mm}/{dd}/{uuid}-{name}` | ✅ After 7 days |

- **Storage Cleanup Service** (`apps/api/src/storage/storage-cleanup.service.ts`) runs two daily crons:
  1. **Daily at 02:30 Bangkok (19:30 UTC)**: Find files where `retentionType='TEMPORARY'` and `expiresAt < now()`, set `deletedAt = now()`.
  2. **Daily at 03:30 Bangkok (20:30 UTC)**: Hard-delete files from Cloudflare R2 bucket and database if soft-deleted more than 24 hours ago.

---

## 4. Automated Database Backups

Database backups run automatically at the platform level using `pg_dump` and are compressed to `.sql.gz` before being uploaded to R2.

### Schedule & Retention:
- **Daily**: Runs at 02:00 Bangkok time (19:00 UTC) -> Kept under `daily/` folder for 30 days.
- **Weekly**: Runs every Sunday at 02:15 Bangkok time (19:15 UTC) -> Kept under `weekly/` folder for 12 weeks.
- **Monthly**: Runs on the 1st of every month at 02:30 Bangkok time (19:30 UTC) -> Kept under `monthly/` folder for 12 months.

### Observability:
- Each run is recorded in the `backup_runs` database table with status, R2 key, size, and error details.
- Super owners can review health and history at `/super-admin/backups` or via:
  - `GET /api/v1/super-admin/backups/health`
  - `GET /api/v1/super-admin/backups/runs`
  - `POST /api/v1/super-admin/backups/run` (manual trigger)
- Backup lifecycle events are written to `audit_logs` with `BACKUP_RUN_*` actions.

---

## 5. Disaster Recovery (DB Restore Guide)

In the event of database corruption or regional failure, follow these steps to restore the latest database backup.

### Prerequisites:
- `psql` command-line tool installed.
- Target database connection string (e.g. empty PostgreSQL database).

### Restore Procedure:

#### Step 1: Download and Decompress the Backup
Download the desired backup file from your Cloudflare R2 `chatwai-backups` bucket (e.g., `daily/daily-2026-06-17.sql.gz`) and extract it:

```bash
# Decompress on Linux/MacOS
gunzip daily-2026-06-17.sql.gz

# Decompress on Windows (using PowerShell or 7-Zip)
Expand-Archive -Path daily-2026-06-17.sql.gz -DestinationPath .
```

#### Step 2: Apply the SQL Dump to the target database
Execute the decompressed plain SQL script on the database:

```bash
# Using standard psql command line
psql "postgresql://username:password@host:port/database" -f daily-2026-06-17.sql
```

*Note: Since the backup SQL is in plain-text SQL format, it contains all the table creation schema, constraints, indexes, and insert data statements in dependency order.*
