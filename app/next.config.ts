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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
