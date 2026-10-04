// Готовность к приёму записей: реквизиты оператора у сервиса и настройки сервера (.env).
import { captchaEnabled } from "./captcha";

type OperatorFields = { status: string; operatorName: string | null; operatorInn: string | null };

/** Живой сайт без реквизитов оператора не принимает записи: согласие клиента без них недействительно (152-ФЗ). */
export function operatorMissing(b: OperatorFields) {
  return b.status !== "demo" && (!b.operatorName?.trim() || !b.operatorInn?.trim());
}

/** Что не настроено на сервере. Показывается красной плашкой в админке. */
export function configProblems(env: Record<string, string | undefined> = process.env): string[] {
  const out: string[] = [];
  const client = !!env.SMARTCAPTCHA_CLIENT_KEY;
  const server = !!env.SMARTCAPTCHA_SERVER_KEY;
  if (client !== server) out.push("Капча: вписан только один ключ SmartCaptcha из двух, капча выключена. Нужны оба: ключ клиента и ключ сервера");
  else if (!client) out.push("Капча выключена: не вписаны ключи SmartCaptcha. Сайты пускают не больше 3 записей в час с одного адреса");
  if (!env.PROCESSOR_NAME?.trim() || !env.PROCESSOR_INN?.trim()) {
    out.push("Не вписаны ваши ФИО или ИНН (PROCESSOR_NAME, PROCESSOR_INN): в оферте и согласиях будет «не указан»");
  }
  if (!env.PROCESSOR_EMAIL?.trim()) out.push("Не вписана ваша почта для документов (PROCESSOR_EMAIL)");
  if (!env.DB_LOCATION?.trim()) out.push("Не указано, где стоит сервер (DB_LOCATION, например «Россия, г. Москва, Timeweb Cloud»): попадает в черновики уведомлений клиентов в Роскомнадзор");
  if (!env.CRON_SECRET || env.CRON_SECRET === "change-me") {
    out.push("Не задан CRON_SECRET: не работают ночная очистка и сертификаты для адресов клиентов");
  }
  return out;
}

/** Капча на боевом сервере выключена: записи пускаем реже. */
export const strictWithoutCaptcha = () => !captchaEnabled() && process.env.NODE_ENV === "production";
