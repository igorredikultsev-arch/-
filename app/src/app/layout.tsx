import type { Metadata, Viewport } from "next";
import { Golos_Text } from "next/font/google";
import "./globals.css";

const golos = Golos_Text({ subsets: ["latin", "cyrillic"], variable: "--font-golos", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Автослот", template: "%s" },
  description: "Сайт с онлайн-записью для автосервиса",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={golos.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
