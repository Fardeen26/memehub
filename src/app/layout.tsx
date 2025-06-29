import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import Navbar from "@/components/Navbar";
import PageTransition from "@/components/PageTransition";
import "./globals.css";
import Providers from "./Provider";
import Footer from "@/components/Footer";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import Head from "next/head";
import { Toaster } from "sonner";
import { siteConfig } from "@/data/site-config";
import OGImage from "./og.png";

const bricolage_grotesque_init = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
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
      <Head>
        <link href="https://fonts.cdnfonts.com/css/impact" rel="stylesheet" />
      </Head>
      <body
        className={`${bricolage_grotesque_init.className} antialiased min-h-screen bg-white dark:bg-black relative`}
      >
        <Providers>
          <PageTransition>
            <Navbar />
            <main className="container mx-auto px-4 py-8">{children}</main>
            <Footer />
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
