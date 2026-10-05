// Сообщения владельцу (раздел 8.3 плана). Менять под каждого сервиса.
// По юридической проверке 5 октября (ст. 15 152-ФЗ): сначала короткий вопрос без цен и ссылки, демо — только после ответа «да».
// Пишем на официальный номер или в сообщество сервиса, а не на личный аккаунт владельца. Ответ «да» сохраняем скриншотом.
import { MONTHLY_PRICE, rub, SETUP_PRICE } from "./pricing";

export const STYLES = "Вверху можно переключить три варианта оформления и выбрать тот, что больше нравится.";

type Biz = { name: string; rating: unknown; yandexMapsUrl: string | null; twoGisUrl?: string | null; status?: string };

/** Подпись: кто пишет и откуда (личное деловое предложение, а не безымянная рассылка — раздел 6.6 плана). */
export const signature = () => `Игорь, Автослот, ${process.env.ROOT_DOMAIN || "avtoslot.ru"}`;

/** Первое сообщение: только вопрос, можно ли прислать пример. Без ссылки и цен. */
export function question(b: Biz) {
  const rating = b.rating ? Number(b.rating).toFixed(1).replace(".", ",") : null;
  const where = b.yandexMapsUrl ? "на Яндекс Картах" : b.twoGisUrl ? "на 2ГИС" : "на картах";
  const seen = rating ? `Посмотрел ваш сервис ${where}: у вас ${rating}, но нет сайта с онлайн-записью.` : `Посмотрел ваш сервис ${where}: у вас нет сайта с онлайн-записью.`;
  return `Здравствуйте! ${seen} Сделал для вас пример такого сайта: клиент сам выбирает свободное время, а вы видите расписание в телефоне.\n\nМожно прислать ссылку и условия? Если неактуально, ответьте «нет», больше не напишу.\n\n${signature()}`;
}

/** Второе сообщение — после ответа «да»: ссылка на демо и условия. */
export function outreach(b: Biz, url: string) {
  const styles = b.status === "demo" ? `\n${STYLES}` : "";
  return `Спасибо, что ответили! Вот пример: ${url}\nТам ваши услуги, адрес и запись на свободное время. Клиент сам выбирает окно, а вы видите всё расписание в телефоне.${styles}\n\nПодключение ${rub(SETUP_PRICE)}, первый месяц уже входит, дальше ${rub(MONTHLY_PRICE)} в месяц. Если за 2 недели не понравится, верну деньги. Если не подойдёт, напишите, больше не побеспокою.\n\n${signature()}`;
}

/**
 * Подставляет ссылку вместо «[ссылка на демо]» в сообщении из таблицы (если места под ссылку нет, добавляет в конец)
 * и в конце того же абзаца говорит про выбор оформления, если в тексте об этом ещё нет.
 */
export function withLink(message: string, url: string) {
  const re = /\[\s*ссылк[аи][^\]]*\]/gi;
  let text = re.test(message) ? message.replace(re, url) : `${message.trimEnd()}\n\n${url}`;
  if (!/оформлени|стил[ья]|дизайн/i.test(message)) {
    const lines = text.split("\n");
    // В конец абзаца со ссылкой
    let at = lines.findIndex((l) => l.includes(url));
    while (at + 1 < lines.length && lines[at + 1].trim()) at++;
    lines.splice(at + 1, 0, STYLES);
    text = lines.join("\n");
  }
  return text;
}
