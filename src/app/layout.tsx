import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unified Inbox",
  description:
    "Open source unified inbox for WhatsApp, Instagram, Messenger, Telegram, X, Reddit, and Bluesky — built on the Zernio API.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before first paint to avoid a light-theme flash for dark-mode users.
// Mirrors src/lib/theme.ts (getStoredTheme + applyTheme), inlined because no
// module code has loaded yet at this point.
const themeInitScript = `
try {
  var theme = localStorage.getItem('unified-inbox-theme');
  if (theme !== 'light' && theme !== 'dark') theme = 'system';
  var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
