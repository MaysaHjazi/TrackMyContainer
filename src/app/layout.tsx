import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ThemeProvider, themeInitScript, THEME_COOKIE } from "@/frontend/theme-provider";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords:    siteConfig.keywords,
  authors:     [{ name: "TrackMyContainer.ai" }],
  creator:     "TrackMyContainer.ai",
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type:        "website",
    locale:      "en_US",
    url:         siteConfig.url,
    title:       siteConfig.name,
    description: siteConfig.description,
    siteName:    siteConfig.name,
    images: [
      {
        url:    siteConfig.ogImage,
        width:  1200,
        height: 630,
        alt:    siteConfig.name,
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       siteConfig.name,
    description: siteConfig.description,
    images:      [siteConfig.ogImage],
  },
  icons: {
    icon:     "/images/favicon.ico",
    shortcut: "/images/favicon-16x16.png",
    apple:    "/images/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B2B5E",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the persisted theme on the server so the SSR HTML already has
  // the right `dark` class on <html> AND the right Hero variant inside.
  // Without this, the server always emits LightHero, the client flips to
  // DarkHero post-hydration, and the user sees the dark page "pop in".
  const cookieStore = await cookies();
  const themeFromCookie = cookieStore.get(THEME_COOKIE)?.value;
  const initialTheme: "light" | "dark" =
    themeFromCookie === "dark" ? "dark" : "light";

  // eslint-disable-next-line no-console
  console.log("[layout] tmc-theme cookie =", themeFromCookie, "→", initialTheme);

  return (
    <html
      lang="en"
      className={initialTheme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        {/* Pre-hydration theme init — keeps localStorage users (pre-cookie
            release) on the right theme + handles OS-preference fallback. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type":    "WebApplication",
              name:       siteConfig.name,
              url:        siteConfig.url,
              description: siteConfig.description,
              applicationCategory: "BusinessApplication",
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "USD",
                lowPrice: 0,
                highPrice: 99,
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
