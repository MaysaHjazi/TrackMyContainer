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
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookieNames = cookieHeader
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter(Boolean);
    console.log(`[auth/callback] BEGIN code=${code.slice(0, 8)}.. cookies(${cookieNames.length}):`, cookieNames.join(", "));

    try {
      const supabase = await createClient();
      console.log(`[auth/callback] supabase client ready, calling exchangeCodeForSession`);

      const startMs = Date.now();
      // Race against a 20s timeout so a stuck SDK call surfaces instead of
      // hanging the whole request and tripping nginx 502.
      const result = await Promise.race([
        supabase.auth.exchangeCodeForSession(code),
        new Promise<{ error: { message: string } }>((_, rej) =>
          setTimeout(() => rej(new Error("EXCHANGE_TIMEOUT_20S")), 20_000),
        ),
      ]);
      console.log(`[auth/callback] exchange returned in ${Date.now() - startMs}ms`);

      if (!result?.error) {
        console.log(`[auth/callback] SUCCESS, redirecting to ${origin}${next}`);
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error("[auth/callback] exchangeCodeForSession returned error:", result.error.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[auth/callback] threw:", msg);
    }
  } else {
    console.log("[auth/callback] no code param");
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
