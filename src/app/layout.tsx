import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dcmshriram.conformal.live"),
  title: "Project Leap Cockpit",
  description: "Agentic executive cockpit for Shriram Farm Solutions",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/sfs-logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Project Leap Cockpit",
    description: "Agentic executive cockpit for Shriram Farm Solutions",
    url: "https://dcmshriram.conformal.live/",
    siteName: "Shriram Farm Solutions",
    images: [
      {
        url: "/sfs-og.png",
        width: 1200,
        height: 630,
        alt: "SFS Project Leap Cockpit",
      },
      {
        url: "/sfs-logo.png",
        width: 512,
        height: 512,
        alt: "SFS logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Project Leap Cockpit",
    description: "Agentic executive cockpit for Shriram Farm Solutions",
    images: ["/sfs-og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
