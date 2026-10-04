import type { Metadata, Viewport } from "next";
// Шрифты лежат в проекте (fontsource), а не скачиваются с Google при сборке: сборка не зависит от доступа к Google,
// а браузер посетителя не обращается к зарубежным серверам. Имя шрифта — в --font-golos (globals.css)
import "@fontsource-variable/golos-text";
import "./globals.css";

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
    <html lang="ru">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
