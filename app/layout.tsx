import type { Metadata } from "next";
import { absolutizeAppOrigin } from "@/lib/app-origin";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Budget Partner HQ",
    template: "%s | Budget Partner HQ",
  },
  description:
    "Your personal finance command centre — track accounts, credit cards, expenses, debts, and savings. Grow your wealth with AI-powered guidance.",
  keywords: ["personal finance", "budget tracker", "expense tracker", "debt manager", "savings goals", "AI finance assistant"],
  authors: [{ name: "Budget Partner HQ" }],
  icons: {
    icon: [
      { url: "/favicon_io/favicon.ico" },
      { url: "/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/favicon_io/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "android-chrome", url: "/favicon_io/android-chrome-192x192.png", sizes: "192x192" },
      { rel: "android-chrome", url: "/favicon_io/android-chrome-512x512.png", sizes: "512x512" },
    ],
  },
  manifest: "/favicon_io/site.webmanifest",
  metadataBase: new URL(absolutizeAppOrigin(process.env.NEXT_PUBLIC_APP_URL)),
  openGraph: {
    type: "website",
    siteName: "Budget Partner HQ",
    images: [{ url: "/favicon_io/android-chrome-512x512.png", width: 512, height: 512, alt: "Budget Partner HQ" }],
  },
  twitter: {
    card: "summary",
    images: ["/favicon_io/android-chrome-512x512.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of unstyled content for dark mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
