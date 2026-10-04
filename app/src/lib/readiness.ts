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
  // Ключ клиента у SmartCaptcha начинается с ysc1_, ключ сервера — с ysc2_; перепутанные ключи дают «некорректный ключ» на сайте
  else if (!env.SMARTCAPTCHA_CLIENT_KEY!.trim().startsWith("ysc1_") || !env.SMARTCAPTCHA_SERVER_KEY!.trim().startsWith("ysc2_")) {
    out.push("Капча: ключи похожи на перепутанные. SMARTCAPTCHA_CLIENT_KEY должен начинаться с ysc1_, SMARTCAPTCHA_SERVER_KEY — с ysc2_");
  }
  if (!env.PROCESSOR_NAME?.trim() || !env.PROCESSOR_INN?.trim()) {
    out.push("Не вписаны ваши ФИО или ИНН (PROCESSOR_NAME, PROCESSOR_INN): в оферте и согласиях будет «не указан»");
  }
  if (!env.PROCESSOR_EMAIL?.trim()) out.push("Не вписана ваша почта для документов (PROCESSOR_EMAIL)");
  if (!env.DB_LOCATION?.trim()) out.push("Не указано, где стоит сервер (DB_LOCATION, например «Россия, г. Москва, Timeweb Cloud»): попадает в черновики уведомлений клиентов в Роскомнадзор");
  if (!env.S3_BUCKET?.trim()) {
    out.push("Копии базы лежат только на этом же сервере (S3_BUCKET не задан): если сервер сломается, пропадут все записи и клиенты. Настройте хранилище, README, «Копии и мониторинг»");
  }
  if (!env.HEALTHCHECK_URL?.trim()) out.push("Нет мониторинга (HEALTHCHECK_URL): если сайт упадёт, вы узнаете об этом от клиентов");
  if (!env.CONTACT_TELEGRAM?.trim()) out.push("Не указан ваш Telegram (CONTACT_TELEGRAM): владельцам в кабинете остаётся только почта для связи");
  if (!env.CRON_SECRET || env.CRON_SECRET === "change-me") {
    out.push("Не задан CRON_SECRET: не работают утренние сводки владельцам и сертификаты для адресов клиентов");
  }
  return out;
}

/** Капча на боевом сервере выключена: записи пускаем реже. */
export const strictWithoutCaptcha = () => !captchaEnabled() && process.env.NODE_ENV === "production";
