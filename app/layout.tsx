import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { EmotionProvider } from "@/lib/emotion";
import { NodesProvider } from "@/contexts/NodesContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const shareTechMono = localFont({
  src: "../public/fonts/sharetechmono/ShareTechMono-Regular.ttf",
  variable: "--font-share-tech-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Xnode - Xandeum pNode Analytics Platform",
  description: "Real-time analytics and monitoring platform for Xandeum pNodes. Track network topology, node performance, uptime, and geographic distribution.",
  keywords: ["Xandeum", "pNode", "analytics", "blockchain", "storage", "monitoring", "dashboard"],
  authors: [{ name: "Xnode Team" }],
  creator: "Xnode",
  publisher: "Xnode",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Xnode - Xandeum pNode Analytics Platform",
    description: "Real-time analytics and monitoring platform for Xandeum pNodes. Track network topology, node performance, uptime, and geographic distribution.",
    siteName: "Xnode",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Xnode Analytics Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Xnode - Xandeum pNode Analytics Platform",
    description: "Real-time analytics and monitoring platform for Xandeum pNodes. Track network topology, node performance, uptime, and geographic distribution.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${shareTechMono.variable} antialiased`}
      >
        <EmotionProvider>
          <NodesProvider>{children}</NodesProvider>
        </EmotionProvider>
      </body>
    </html>
  );
}
