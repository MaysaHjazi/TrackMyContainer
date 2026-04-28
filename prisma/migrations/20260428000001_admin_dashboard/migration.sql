-- Add role column to users (TEXT — same approach as the subscription migration)
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- audit_log table
CREATE TABLE "audit_log" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT,
  "type"      TEXT NOT NULL,
  "level"     TEXT NOT NULL DEFAULT 'info',
  "message"   TEXT NOT NULL,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_log_type_createdAt_idx"     ON "audit_log"("type", "createdAt");
CREATE INDEX "audit_log_userId_createdAt_idx"   ON "audit_log"("userId", "createdAt");
CREATE INDEX "audit_log_level_createdAt_idx"    ON "audit_log"("level", "createdAt");

ALTER TABLE "audit_log"
  ADD CONSTRAINT "audit_log_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
