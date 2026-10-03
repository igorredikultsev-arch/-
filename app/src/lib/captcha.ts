// Яндекс SmartCaptcha (раздел 6.3: российский сервис, данные не уходят за рубеж).
// Без ключей капча выключена — так удобно в разработке. На боевом сервере ключи обязательны.

export const captchaClientKey = () => process.env.SMARTCAPTCHA_CLIENT_KEY || "";

export type CaptchaResult = "ok" | "fail" | "unavailable";

/**
 * Проверка токена SmartCaptcha. «unavailable» — сервис Яндекса не ответил: запись не теряем,
 * но вызывающий код ужесточает лимиты. Без ключей капча выключена (только для разработки).
 */
export async function verifyCaptcha(token: string | undefined, ip: string | undefined): Promise<CaptchaResult> {
  const secret = process.env.SMARTCAPTCHA_SERVER_KEY;
  if (!secret) return "ok";
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
