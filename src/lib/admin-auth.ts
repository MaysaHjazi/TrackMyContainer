import { prisma } from "@/backend/lib/db";
import { recordEvent } from "@/lib/audit-log";

export interface AdminAuthInput {
  id:    string;
  email: string;
  role:  "USER" | "ADMIN";
}

function envAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true if the given user is permitted to access /admin pages.
 * If the user's email is in ADMIN_EMAILS but their DB role is still
 * USER, lazily promote them to ADMIN (idempotent — only the first
 * call writes to the DB) and audit-log the promotion.
 */
export async function isAdmin(user: AdminAuthInput): Promise<boolean> {
  const allowed = envAdminEmails();
  const emailMatch = allowed.includes(user.email.toLowerCase());

  if (emailMatch) {
    if (user.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: user.id },
        data:  { role: "ADMIN" },
      });
      await recordEvent({
        type:    "auth.admin_promoted",
        level:   "info",
        message: `${user.email} auto-promoted via ADMIN_EMAILS`,
        userId:  user.id,
      });
    }
    return true;
  }

  return user.role === "ADMIN";
}
