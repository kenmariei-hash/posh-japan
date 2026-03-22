import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/lib/site-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  metadataBase: appUrl ? new URL(appUrl) : undefined,
  title: {
    default: siteConfig.serviceName,
    template: `%s | ${siteConfig.serviceName}`,
  },
  description:
    "学生、ナイトイベント、ウェルネスイベントを見つけて参加できるイベントアプリ。",
  openGraph: {
    title: siteConfig.serviceName,
    description:
      "学生、ナイトイベント、ウェルネスイベントを見つけて参加できるイベントアプリ。",
    url: appUrl || undefined,
    siteName: siteConfig.serviceName,
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.serviceName,
    description:
      "学生、ナイトイベント、ウェルネスイベントを見つけて参加できるイベントアプリ。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
