import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Браузер ходит на сайт только по https (все адреса отдаёт Caddy с сертификатом)
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // Базовые ограничения без запрета встроенных скриптов (Next.js и капча Яндекса их используют)
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const config: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["@node-rs/argon2"],
  // next/image в проекте не используется: адрес /_next/image (сжатие картинок по запросу) выключен, чтобы через него
  // нельзя было нагружать сервер пережатием загруженных логотипов
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Обработчик уведомлений кабинета: браузер всегда проверяет свежую версию
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default config;
