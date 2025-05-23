import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { SmoothCursor } from "@/components/ui/smooth-cursor";
import Navbar from "@/components/Navbar";
import PageTransition from "@/components/PageTransition";
import "./globals.css";
import Providers from "./Provider";
import Footer from "@/components/Footer";
import Script from "next/script";

const bricolage_grotesque_init = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memify",
  description: "Developed by Fardeen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${bricolage_grotesque_init.className} antialiased !cursor-none min-h-screen bg-white dark:bg-black relative`}
      >
        <Providers>
          <PageTransition>
            <Navbar />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
            <Footer />
            <SmoothCursor />
          </PageTransition>
        </Providers>
        <Script
          defer
          data-domain="memify.fardeen.tech"
          src="https://analytics-code.vercel.app/tracking-script.js"
        />
      </body>
    </html>
  );
}
