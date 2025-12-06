import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { EmotionProvider } from "@/lib/emotion";
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
  title: "Xnode",
  description: "Xnode Analytics Platform",
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
        <EmotionProvider>{children}</EmotionProvider>
      </body>
    </html>
  );
}
