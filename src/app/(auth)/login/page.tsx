"use client";

import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="animate-[authIn_0.5s_ease-out]">
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight text-navy-900 dark:text-white">
          Welcome back
        </h1>
        <p className="mt-1.5 text-[14px] text-navy-500 dark:text-white/45">
          Sign in to pick up where your cargo left off.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/80
                     px-4 py-3 text-[13px] font-medium text-red-700
                     dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
        >
          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
          {error}
        </div>
      )}

      {/* Google */}
      <button
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="group flex w-full items-center justify-center gap-3 rounded-xl
                   border border-navy-200 bg-white px-4 py-3 text-[14px] font-semibold
                   text-navy-700 shadow-[0_1px_2px_rgba(15,25,51,0.04)]
                   transition-all hover:border-navy-300 hover:shadow-[0_4px_14px_-6px_rgba(15,25,51,0.18)]
                   active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed
                   dark:border-white/12 dark:bg-white/[0.04] dark:text-white
                   dark:hover:border-white/25 dark:hover:bg-white/[0.07]"
      >
        {googleLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        )}
        Continue with Google
      </button>

      {/* Divider */}
      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-navy-200/70 dark:bg-white/10" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-400 dark:text-white/35">
          or with email
        </span>
        <div className="h-px flex-1 bg-navy-200/70 dark:bg-white/10" />
      </div>

      {/* Form */}
      <form onSubmit={handleEmailLogin} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-[12px] font-semibold uppercase tracking-wider
                       text-navy-500 dark:text-white/50"
          >
            Email
          </label>
          <div className="group relative">
            <Mail
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2
                         text-navy-300 transition-colors group-focus-within:text-orange-500
                         dark:text-white/30"
            />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full rounded-xl border border-navy-200 bg-white py-3 pl-11 pr-4
                         text-[14px] text-navy-900 placeholder:text-navy-300
                         transition-all focus:border-orange-500 focus:outline-none
                         focus:ring-4 focus:ring-orange-500/12
                         dark:border-white/12 dark:bg-white/[0.03] dark:text-white
                         dark:placeholder:text-white/25 dark:focus:border-orange-400
                         dark:focus:ring-orange-400/15"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[12px] font-semibold uppercase tracking-wider
                         text-navy-500 dark:text-white/50"
            >
              Password
            </label>
          </div>
          <div className="group relative">
            <Lock
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2
                         text-navy-300 transition-colors group-focus-within:text-orange-500
                         dark:text-white/30"
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full rounded-xl border border-navy-200 bg-white py-3 pl-11 pr-12
                         text-[14px] text-navy-900 placeholder:text-navy-300
                         transition-all focus:border-orange-500 focus:outline-none
                         focus:ring-4 focus:ring-orange-500/12
                         dark:border-white/12 dark:bg-white/[0.03] dark:text-white
                         dark:placeholder:text-white/25 dark:focus:border-orange-400
                         dark:focus:ring-orange-400/15"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1
                         text-navy-300 transition-colors hover:text-navy-600
                         dark:text-white/30 dark:hover:text-white/70"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group relative flex w-full items-center justify-center gap-2
                     overflow-hidden rounded-xl bg-[#F5821F] py-3.5 text-[14px] font-bold
                     text-white shadow-[0_10px_28px_-10px_rgba(245,130,31,0.6)]
                     transition-all hover:bg-[#E0710F] active:scale-[0.99]
                     disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {/* sheen sweep on hover */}
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full bg-gradient-to-r
                       from-transparent via-white/25 to-transparent
                       transition-transform duration-700 group-hover:translate-x-full"
          />
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      {/* Register */}
      <p className="mt-7 text-center text-[13.5px] text-navy-500 dark:text-white/45">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-orange-600 underline-offset-4 hover:underline
                     dark:text-orange-400"
        >
          Sign up free
        </Link>
      </p>

      <style>{`@keyframes authIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-40 rounded-lg bg-navy-200/60 dark:bg-white/10" />
          <div className="h-4 w-56 rounded bg-navy-200/50 dark:bg-white/[0.07]" />
          <div className="h-12 rounded-xl bg-navy-200/40 dark:bg-white/[0.05]" />
          <div className="h-12 rounded-xl bg-navy-200/40 dark:bg-white/[0.05]" />
          <div className="h-12 rounded-xl bg-navy-200/40 dark:bg-white/[0.05]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
