import type { Metadata } from "next";
import { Bricolage_Grotesque, Anton, Oswald, Bebas_Neue, Montserrat, Open_Sans, Lato, Poppins, Source_Sans_3, Nunito, Inter, Work_Sans, Roboto_Condensed } from "next/font/google";
import Navbar from "@/components/Navbar";
import PageTransition from "@/components/PageTransition";
import "./globals.css";
import Providers from "./Provider";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

import { Toaster } from "sonner";
import { siteConfig } from "@/data/site-config";
import OGImage from "./og.png";

const bricolage_grotesque_init = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
});

// Load all fonts used in the meme editor
const anton = Anton({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

const oswald = Oswald({
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "300", "400", "500", "600", "700"],
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const lato = Lato({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "300", "400", "700", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
});

const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const workSans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
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
        className={`${bricolage_grotesque_init.className} ${anton.className} ${oswald.className} ${bebasNeue.className} ${montserrat.className} ${openSans.className} ${lato.className} ${poppins.className} ${sourceSans.className} ${nunito.className} ${inter.className} ${workSans.className} ${robotoCondensed.className} antialiased min-h-screen bg-white dark:bg-black relative`}
        style={{
          fontFamily: `var(--font-bricolage-grotesque), var(--font-anton), var(--font-oswald), var(--font-bebas-neue), var(--font-montserrat), var(--font-open-sans), var(--font-lato), var(--font-poppins), var(--font-source-sans-3), var(--font-nunito), var(--font-inter), var(--font-work-sans), var(--font-roboto-condensed), Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif`
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
