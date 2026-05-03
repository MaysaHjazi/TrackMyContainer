import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Use the default cookie-based storage from @supabase/ssr. The earlier
 * version pinned `storage: window.sessionStorage`, which broke OAuth:
 * the PKCE code verifier was written to sessionStorage on this device
 * and the SSR callback handler (running on the server) had no way to
 * read it. Result: every Google sign-in failed with
 *   "PKCE code verifier not found in storage"
 * even though Google + Supabase had successfully issued the code.
 *
 * createBrowserClient with no storage override stores PKCE state in
 * cookies, which both the browser AND our /auth/callback route can
 * read — that's the whole point of @supabase/ssr.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
