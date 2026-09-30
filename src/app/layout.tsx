import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

/**
 * Inline, render-blocking script: sets the html class before first paint.
 * The theme switch was removed from the site, so the page is always dark.
 */
const themeBootScript = `(function(){var c=document.documentElement.classList;c.remove('light');c.add('dark');})();`;

const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230f1111'/%3E%3Crect x='9' y='9' width='14' height='14' fill='%23c0fe04'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: 'Portfolio',
  icons: { icon: [{ url: ICON, type: 'image/svg+xml' }] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f1111',
};

/** Root: html shell + fonts only. The site lives in app/(site), the CMS in app/admin. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="preload" href="/fonts/TikTokSans-std.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/DepartureMono-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/GeistMono-wght.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
