import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-navy-50 via-white to-teal-50 px-4 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">

      {/* Top gradient bar */}
      <div className="fixed top-0 left-0 h-1 w-full bg-gradient-to-r from-teal-400 via-navy-600 to-orange-500 dark:via-orange-500 z-50" />

      {/* Logo */}
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="text-xl font-bold">
          <span className="text-navy-600 dark:text-white">Container</span>
          <span className="text-orange-500"> Tracking</span>
        </span>
      </Link>

      {/* Auth card */}
      <div className="w-full max-w-md">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-navy-400 dark:text-navy-500">
        &copy; {new Date().getFullYear()} Container Tracking — All rights reserved.
      </p>
    </div>
  );
}
