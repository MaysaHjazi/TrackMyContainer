import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ThemeProvider, themeInitScript } from "@/frontend/theme-provider";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme init — must run before paint to avoid FOUC */}
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
