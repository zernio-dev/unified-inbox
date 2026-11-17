import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

const LOGO_HARMO_URL = "https://storage.googleapis.com/gpt-engineer-file-uploads/GyY8YdQwvqSqDbwid2ztdoQxLER2/uploads/1770698837610-logo_harmo.jpg";

export const metadata: Metadata = {
  title: "Caixa de Entrada",
  description: "Caixa de entrada unificada de atendimento - Harmo Store",
  icons: {
    icon: [
      { url: LOGO_HARMO_URL, type: "image/jpeg" },
      { url: "/logo_harmo.jpg", type: "image/jpeg" },
      { url: "/favicon.ico", type: "image/jpeg" },
    ],
    shortcut: LOGO_HARMO_URL,
    apple: LOGO_HARMO_URL,
  },
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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>Caixa de Entrada</title>
        <link rel="icon" type="image/jpeg" href={LOGO_HARMO_URL} />
        <link rel="icon" type="image/jpeg" href="/logo_harmo.jpg" />
        <link rel="icon" type="image/jpeg" href="/favicon.ico" />
        <link rel="apple-touch-icon" href={LOGO_HARMO_URL} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
