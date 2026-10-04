// Первое сообщение владельцу (раздел 8.3 плана). Менять под каждого сервиса.

export const STYLES = "Вверху можно переключить три варианта оформления и выбрать тот, что больше нравится.";

type Biz = { name: string; rating: unknown; yandexMapsUrl: string | null; twoGisUrl?: string | null; status?: string };

/** Подпись: кто пишет и откуда (личное деловое предложение, а не безымянная рассылка — раздел 6.6 плана). */
export const signature = () => `Игорь, Автослот, ${process.env.ROOT_DOMAIN || "avtoslot.ru"}`;

export function outreach(b: Biz, url: string) {
  const rating = b.rating ? Number(b.rating).toFixed(1).replace(".", ",") : null;
  const where = b.yandexMapsUrl ? "на Яндекс Картах" : b.twoGisUrl ? "на 2ГИС" : "на картах";
  const intro = rating ? `Посмотрел ваш сервис ${where}: у вас ${rating}, но нет сайта с онлайн-записью, клиентам приходится звонить.` : `Посмотрел ваш сервис ${where}: у вас нет сайта с онлайн-записью, клиентам приходится звонить.`;
  const styles = b.status === "demo" ? `\n${STYLES}` : "";
  return `Здравствуйте! ${intro}\n\nСделал для вас пример: ${url}\nТам ваши услуги, адрес и запись на свободное время. Клиент сам выбирает окно, а вы видите всё расписание в телефоне.${styles}\n\nПодключение 3 500 ₽, первые 2 недели бесплатно. Если неактуально, напишите, больше не побеспокою.\n\n${signature()}`;
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
