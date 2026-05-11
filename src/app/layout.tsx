import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { isDcmshriramSite } from "@/lib/site-variant";
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

const conformalMetadata: Metadata = {
  metadataBase: new URL("https://conformal.live"),
  title: {
    default: "Conformal | AI transformation, in working code",
    template: "%s | Conformal",
  },
  description:
    "We build the AI products that legacy enterprises actually ship, replacing slide decks with working software, six weeks at a time.",
  applicationName: "Conformal",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Conformal",
    description:
      "AI transformation for enterprise leaders. We ship working agents in six weeks, not slide decks in six quarters.",
    url: "https://conformal.live",
    siteName: "Conformal",
    images: [{ url: "https://conformal.live/opengraph-image", width: 1200, height: 630 }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conformal",
    description:
      "AI transformation for enterprise leaders. We ship working agents in six weeks, not slide decks in six quarters.",
  },
};

const dcmshriramMetadata: Metadata = {
  metadataBase: new URL("https://dcmshriram.conformal.live"),
  title: "Project Leap Cockpit",
  description: "Executive cockpit for Shriram Farm Solutions",
  applicationName: "Project Leap Cockpit",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Project Leap Cockpit",
    description: "Executive cockpit for Shriram Farm Solutions",
    url: "https://dcmshriram.conformal.live/",
    siteName: "Shriram Farm Solutions",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Project Leap Cockpit",
    description: "Executive cockpit for Shriram Farm Solutions",
  },
};

export const metadata: Metadata = isDcmshriramSite() ? dcmshriramMetadata : conformalMetadata;

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
