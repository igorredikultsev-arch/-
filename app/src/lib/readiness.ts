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

/**
 * Оплату записывают только подключённому сервису: сначала «Создать вход» (вход владельцу, реквизиты, тестовые записи
 * демо убираются), потом оплата. Иначе запись оплаты сделала бы демо живым сайтом без владельца и реквизитов.
 */
export function connectFirst(b: { status: string; owners: number }): string | null {
  // Владелец есть (например, бывший клиент, возвращённый как демо): оплату можно записать сразу, его записи не трогаем
  if (b.owners === 0) return "Оплату записывают после подключения: сначала «Создать вход» на вкладке «Подключение», потом оплата";
  return null;
}

type Status = "demo" | "trial" | "active" | "suspended" | "archived";

/**
 * Смена статуса сервиса вместе с датой приостановки — единственное место, где она ставится и стирается.
 * Приостановили — дата сегодня; клиент снова работает (подключили, оплатил, активировали) — дата стёрта;
 * в архиве и при возврате как демо дата остаётся: обязанность удалить данные бывшего клиента не пропадает.
 */
export function statusChange(status: Status, now = new Date()): { status: Status; suspendedAt?: Date | null } {
  if (status === "suspended") return { status, suspendedAt: now };
  if (status === "active" || status === "trial") return { status, suspendedAt: null };
  return { status };
}

/** Оферта, п. 4.2: через столько дней приостановки договор считается расторгнутым. */
export const TERMINATE_AFTER_DAYS = 60;
/** Оферта, п. 7.7: после расторжения данные уничтожаются в течение стольких дней, владельцу — акт об уничтожении. */
export const DESTROY_WITHIN_DAYS = 30;

/**
 * Пора удалять данные бывшего клиента: сайт приостановлен (или уже в архиве после приостановки) 60 дней и больше.
 * deleteBy — последний день, до которого данные нужно уничтожить. null — напоминать рано или не о чем.
 */
export function terminationDue(b: { status: string; suspendedAt: Date | null }, now = Date.now()): { deleteBy: Date; terminatedAt: Date } | null {
  if (!b.suspendedAt || (b.status !== "suspended" && b.status !== "archived")) return null;
  const terminatedAt = b.suspendedAt.getTime() + TERMINATE_AFTER_DAYS * 86400000;
  if (now < terminatedAt) return null;
  return { terminatedAt: new Date(terminatedAt), deleteBy: new Date(terminatedAt + DESTROY_WITHIN_DAYS * 86400000) };
}
