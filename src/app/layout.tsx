import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import Navbar from "@/components/Navbar";
import PageTransition from "@/components/PageTransition";
import "./globals.css";
import Providers from "./Provider";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

import { Toaster } from "sonner";
import { siteConfig } from "@/data/site-config";
import OGImage from "./og.png";

// Only load the essential font for initial page load
const bricolage_grotesque_init = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  keywords: siteConfig.keywords,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: OGImage.src,
        width: OGImage.width,
        height: OGImage.height,
        alt: siteConfig.name,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    title: siteConfig.name,
    description: siteConfig.description,
    site: siteConfig.twitterHandle,
    card: "summary_large_image",
    images: [
      {
        url: OGImage.src,
        width: OGImage.width,
        height: OGImage.height,
        alt: siteConfig.name,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>

      <body
        className={`${bricolage_grotesque_init.className} antialiased min-h-screen bg-white dark:bg-black relative`}
        style={{
          fontFamily: `var(--font-bricolage-grotesque), Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif`
        }}
      >
        <Providers>
          <PageTransition>
            <Navbar />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </PageTransition>
          <Toaster />
        </Providers>
        <Analytics />
        <Script
          defer
          data-domain="memehub.fardeen.tech"
          src="https://analytics-code.vercel.app/tracking-script.js"
        />
      </body>
    </html>
  );
}
