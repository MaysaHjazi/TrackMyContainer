import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const MANIFEST = {
  name: "TrackMyContainer.ai",
  short_name: "TrackMyContainer",
  description: "Real-time global tracking for sea containers and air cargo shipments.",
  start_url: "/",
  display: "standalone",
  background_color: "#060E1E",
  theme_color: "#1B2B5E",
  icons: [
    { src: "/images/logo-mark.png", sizes: "192x192", type: "image/png" },
    { src: "/images/logo-mark.png", sizes: "512x512", type: "image/png" },
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Serve web app manifest directly — avoids static-file serving issues
  if (pathname === "/site.webmanifest" || pathname === "/manifest.webmanifest") {
    return new NextResponse(JSON.stringify(MANIFEST), {
      headers: { "Content-Type": "application/manifest+json" },
    });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - images/ directory
     * - common static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)",
  ],
};
