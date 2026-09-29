import { Cormorant_Garamond, JetBrains_Mono, Manrope } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AngeLifeline",
  description:
    "Privacy-first open-source crisis routing overlay for any chat host.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jetbrains.variable} ${manrope.variable} h-full`}
    >
      <body className="min-h-full font-[family-name:var(--font-manrope)] antialiased">
        {children}
      </body>
    </html>
  );
}
