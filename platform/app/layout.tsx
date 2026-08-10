import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BrandStyle } from "@/components/BrandStyle";
import { PageLoader } from "@/components/PageLoader";
import { getLocale } from "@/lib/locale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EA Audit",
  description: "Statutory audit platform (ISA / OHADA)",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* stamp the theme before first paint — stored choice, else the OS */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem(\"theme\");if(t!==\"light\"&&t!==\"dark\"){t=matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\"}document.documentElement.setAttribute(\"data-theme\",t)}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <BrandStyle />
        <PageLoader />
        {children}
      </body>
    </html>
  );
}
