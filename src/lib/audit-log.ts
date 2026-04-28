import { prisma } from "@/backend/lib/db";

export type AuditLevel = "info" | "warning" | "error";

export interface RecordEventInput {
  type:      string;
  level?:    AuditLevel;
  message:   string;
  userId?:   string;
  metadata?: Record<string, unknown>;
}

/**
 * Append a row to the `audit_log` table. Wrapped in try/catch so it
 * NEVER throws — callers in the existing tracking/billing/notification
 * paths can use this without risk of corrupting their own behaviour
 * if the audit write happens to fail.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        type:     input.type,
        level:    input.level ?? "info",
        message:  input.message,
        userId:   input.userId   ?? null,
        metadata: (input.metadata as never) ?? null,
      },
    });
  } catch (err) {
    console.warn(
      `[audit-log] failed to record ${input.type}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
