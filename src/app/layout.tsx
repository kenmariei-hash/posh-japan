import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/lib/site-config";
import "./globals.css";

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
      <body className="antialiased">
        <AuthProvider>
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
