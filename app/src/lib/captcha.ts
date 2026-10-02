// Яндекс SmartCaptcha (раздел 6.3: российский сервис, данные не уходят за рубеж).
// Без ключей капча выключена — так удобно в разработке. На боевом сервере ключи обязательны.

export const captchaClientKey = () => process.env.SMARTCAPTCHA_CLIENT_KEY || "";

export async function verifyCaptcha(token: string | undefined, ip: string | undefined): Promise<boolean> {
  const secret = process.env.SMARTCAPTCHA_SERVER_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, token, ...(ip ? { ip } : {}) });
    const res = await fetch("https://smartcaptcha.yandexcloud.net/validate", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return true; // сбой сервиса капчи не должен блокировать запись; остаются лимиты
    const data = (await res.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return true;
  }
}
