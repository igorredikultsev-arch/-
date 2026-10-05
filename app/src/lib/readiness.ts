// Готовность к приёму записей: реквизиты оператора у сервиса и настройки сервера (.env).
import { captchaEnabled } from "./captcha";
import { db } from "./db";

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
  // С 1 июля 2025 данные россиян нельзя собирать в зарубежных базах (ч. 5 ст. 18 152-ФЗ), почта в документах — российская
  else if (/@(gmail|googlemail|outlook|hotmail|live|icloud|me|yahoo|proton|protonmail)\./i.test(env.PROCESSOR_EMAIL)) {
    out.push("Почта в документах на зарубежном сервисе (PROCESSOR_EMAIL): замените на Яндекс или Mail.ru");
  }
  if (!env.HOSTING_PROVIDER?.trim()) out.push("Не указан хостинг-провайдер (HOSTING_PROVIDER, название и ИНН из договора): попадает в список подрядчиков в оферте");
  if (!env.DB_LOCATION?.trim()) out.push("Не указано, где стоит сервер (DB_LOCATION, например «Россия, г. Москва, Timeweb Cloud»): попадает в черновики уведомлений клиентов в Роскомнадзор");
  if (!env.S3_BUCKET?.trim()) {
    out.push("Копии базы лежат только на этом же сервере (S3_BUCKET не задан): если сервер сломается, пропадут все записи и клиенты. Настройте хранилище, README, «Копии и мониторинг»");
  }
  // Внешний мониторинг (Statuser и т. п.) сервер сам не видит: о нём говорит MONITORING в .env
  if (!env.HEALTHCHECK_URL?.trim() && !env.MONITORING?.trim()) {
    out.push("Нет мониторинга (HEALTHCHECK_URL или MONITORING): если сайт упадёт, вы узнаете об этом от клиентов");
  }
  if (!env.CONTACT_TELEGRAM?.trim()) out.push("Не указан ваш Telegram (CONTACT_TELEGRAM): владельцам в кабинете остаётся только почта для связи");
  if (!env.CRON_SECRET || env.CRON_SECRET === "change-me") {
    out.push("Не задан CRON_SECRET: не работают утренние сводки владельцам и сертификаты для адресов клиентов");
  }
  return out;
}

/** Капча на боевом сервере выключена: записи пускаем реже. */
export const strictWithoutCaptcha = () => !captchaEnabled() && process.env.NODE_ENV === "production";

/** Ночная копия базы отмечается в журнале (deploy/backup.sh). Через 2 суток без отметки — предупреждение в админке. */
export const BACKUP_MAX_AGE_H = 50;

export async function backupProblem(now = Date.now()): Promise<string | null> {
  const last = await db.auditLog.findFirst({ where: { businessId: null, action: "backup.done" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, details: true } });
  if (!last) return "Ночная копия базы ещё ни разу не отметилась. Выполните на сервере ./deploy/backup.sh и проверьте, что в конце нет ошибки";
  if (now - last.createdAt.getTime() > BACKUP_MAX_AGE_H * 3600000) {
    const when = last.createdAt.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Yekaterinburg" });
    return `Ночная копия базы не делалась больше 2 суток (последняя — ${when}). Посмотрите ошибку на сервере: tail deploy/backup.log`;
  }
  const s3 = (last.details as { s3?: boolean } | null)?.s3;
  if (s3 === false && process.env.S3_BUCKET?.trim()) return "Последняя копия базы не ушла в хранилище: посмотрите ошибку на сервере, tail deploy/backup.log";
  return null;
}
