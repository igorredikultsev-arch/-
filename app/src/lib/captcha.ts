// Яндекс SmartCaptcha (раздел 6.3: российский сервис, данные не уходят за рубеж).
// Капча включена, только когда заданы оба ключа. Без них (или с одним) капча выключена: в разработке так удобно,
// а на боевом сервере сайт пускает записи реже (см. api/s/[slug]/bookings) и админка показывает предупреждение.

export const captchaEnabled = () => !!(process.env.SMARTCAPTCHA_CLIENT_KEY && process.env.SMARTCAPTCHA_SERVER_KEY);

export const captchaClientKey = () => (captchaEnabled() ? process.env.SMARTCAPTCHA_CLIENT_KEY! : "");

export type CaptchaResult = "ok" | "fail" | "unavailable" | "off";

/**
 * Проверка токена SmartCaptcha. «unavailable» — сервис Яндекса не ответил: запись не теряем,
 * но вызывающий код ужесточает лимиты. «off» — капча не настроена.
 */
export async function verifyCaptcha(token: string | undefined, ip: string | undefined): Promise<CaptchaResult> {
  if (!captchaEnabled()) return "off";
  const secret = process.env.SMARTCAPTCHA_SERVER_KEY!;
  if (!token) return "fail";
  try {
    const body = new URLSearchParams({ secret, token, ...(ip ? { ip } : {}) });
    const res = await fetch("https://smartcaptcha.yandexcloud.net/validate", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "unavailable";
    const data = (await res.json()) as { status?: string };
    return data.status === "ok" ? "ok" : "fail";
  } catch {
    return "unavailable";
  }
}
