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
    <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-lg dark:border-navy-800 dark:bg-navy-900">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-navy-600 dark:text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-navy-400 dark:text-navy-300">Sign in to your dashboard</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Google sign-in */}
      <button
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-navy-200 bg-white px-4 py-3
                   text-sm font-semibold text-navy-600 hover:bg-navy-50 transition-colors
                   disabled:opacity-60 disabled:cursor-not-allowed
                   dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700"
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
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-navy-100 dark:bg-navy-800" />
        <span className="text-xs font-medium text-navy-400 dark:text-navy-500">or sign in with email</span>
        <div className="h-px flex-1 bg-navy-100 dark:bg-navy-800" />
      </div>

      {/* Email/Password form */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-navy-600 dark:text-navy-200">
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300 dark:text-navy-500" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full rounded-xl border border-navy-200 bg-white py-3 pl-10 pr-4
                         text-sm text-navy-600 placeholder:text-navy-300
                         focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100
                         dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:placeholder:text-navy-500
                         dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-navy-600 dark:text-navy-200">
            Password
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300 dark:text-navy-500" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full rounded-xl border border-navy-200 bg-white py-3 pl-10 pr-12
                         text-sm text-navy-600 placeholder:text-navy-300
                         focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100
                         dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:placeholder:text-navy-500
                         dark:focus:border-orange-400 dark:focus:ring-orange-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-500 dark:text-navy-500 dark:hover:text-navy-300"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3
                     text-sm font-bold text-white hover:bg-orange-600 active:bg-orange-700
                     transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Sign In
        </button>
      </form>

      {/* Register link */}
      <p className="mt-6 text-center text-sm text-navy-400 dark:text-navy-300">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-orange-500 hover:underline dark:text-orange-400">
          Sign up free
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-lg dark:border-navy-800 dark:bg-navy-900 animate-pulse">
        <div className="h-8 bg-navy-100 dark:bg-navy-800 rounded mb-4" />
        <div className="h-4 bg-navy-100 dark:bg-navy-800 rounded w-2/3 mx-auto" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
