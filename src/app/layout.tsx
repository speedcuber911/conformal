import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://conformal.live"),
  title: {
    default: "Conformal",
    template: "%s | Conformal",
  },
  description:
    "Conformal turns four-year enterprise AI transformations into production agent programs across many engagements.",
  applicationName: "Conformal",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Conformal",
    description:
      "Four-year AI transformation programs delivered as many production agent engagements.",
    url: "https://conformal.live/",
    siteName: "Conformal",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conformal",
    description:
      "Four-year AI transformation programs delivered as many production agent engagements.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
