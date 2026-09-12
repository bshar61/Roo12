import type { Metadata } from "next";
import "./globals.css";
import "./vap-pro.css";
import "./intelligence.css";
import "./v25.css";
import "./white-mint.css";
import "./aurora.css";

export const metadata: Metadata = {
  title: "Quotex V26 Aurora | BSHAR SALMAT SY",
  description: "غرفة عربية لمتابعة أزواج OTC والمؤشرات والإشارات ونتائجها بشفافية.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
