import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the externally-visible origin of this request.
 *
 * `new URL(request.url).origin` returns the *internal* host the Next.js
 * server bound to (e.g. `https://0.0.0.0:3000`) when the request was
 * proxied through nginx/openresty. Redirecting to that URL from the
 * browser breaks: the user lands on a dead host after a successful
 * Google sign-in.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL              — explicit, set in prod env
 *   2. X-Forwarded-Proto + X-Forwarded-Host  — what nginx forwards
 *   3. Host header                      — fallback
 *   4. URL.origin                       — last resort, dev only
 */
function publicOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const fwdProto = request.headers.get("x-forwarded-proto");
  const fwdHost  = request.headers.get("x-forwarded-host");
  if (fwdProto && fwdHost) return `${fwdProto}://${fwdHost}`;

  const host = request.headers.get("host");
  if (host) return `https://${host}`;

  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code   = searchParams.get("code");
  const next   = searchParams.get("next") ?? "/dashboard";
  const origin = publicOrigin(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
