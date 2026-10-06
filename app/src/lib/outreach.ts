// Сообщение владельцу (раздел 8.3 плана). Менять под каждого сервиса.
// С 6 октября 2026 (решение Игоря) демо отправляем сразу, первым сообщением: со ссылкой и ценой.
// Юридическая проверка 5 октября советовала сначала спрашивать «можно прислать?» (ст. 15 152-ФЗ) — риск принят осознанно.
// Пишем на официальный номер или в сообщество сервиса, а не на личный аккаунт владельца. После отказа больше не пишем.
import { MONTHLY_PRICE, rub, SETUP_PRICE, EARLY_CLIENTS } from "./pricing";
import { toLocal } from "./time";

export const STYLES = "Вверху можно переключить три варианта оформления и выбрать тот, что больше нравится.";

type Biz = {
  name: string;
  rating: unknown;
  reviews2gis?: number | null;
  reviewsYandex?: number | null;
  yandexMapsUrl: string | null;
  twoGisUrl?: string | null;
  status?: string;
  timezone?: string;
};

/** Подпись: кто пишет и откуда (личное деловое предложение, а не безымянная рассылка — раздел 6.6 плана). */
export const signature = () => `Игорь, Автослот, ${process.env.ROOT_DOMAIN || "avtoslot.ru"}`;

/** 1 отзыв, 3 отзыва, 25 отзывов */
export function reviewsText(n: number) {
  const n10 = n % 10, n100 = n % 100;
  const word = n10 === 1 && n100 !== 11 ? "отзыв" : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? "отзыва" : "отзывов";
  return `${n} ${word}`;
}

/** «Увидел вас в 2ГИС: 4,9 и 173 отзыва» — рейтинг называем, только когда им можно похвалить (от 4,7). */
function seen(b: Biz) {
  const gis = !!b.twoGisUrl || (!b.yandexMapsUrl && b.reviews2gis != null);
  const where = gis ? "в 2ГИС" : b.yandexMapsUrl ? "на Яндекс Картах" : "на картах";
  const reviews = gis ? b.reviews2gis : b.reviewsYandex;
  const rating = b.rating != null && Number(b.rating) >= 4.7 ? Number(b.rating).toFixed(1).replace(".", ",") : null;
  const facts = [rating, reviews ? reviewsText(reviews) : null].filter(Boolean).join(" и ");
  return facts ? `Увидел вас ${where}: ${facts}` : `Увидел ваш сервис ${where}`;
}

/** Сезон переобувки: октябрь–ноябрь и март–апрель. */
function inSeason(nowMs: number, tz: string) {
  const month = Number(toLocal(nowMs, tz).date.slice(5, 7));
  return [3, 4, 10, 11].includes(month);
}

/**
 * Первое сообщение: сразу ссылка на демо и цена, чтобы не думали, что это сайт за 20 тысяч.
 * early — подключение ещё по цене для первых клиентов (меньше EARLY_CLIENTS оплативших).
 */
export function outreach(b: Biz, url: string, opts: { early?: boolean; now?: number } = {}) {
  const styles = b.status === "demo" ? `\n${STYLES}` : "";
  const less = inSeason(opts.now ?? Date.now(), b.timezone || "Asia/Yekaterinburg") ? "В сезон переобувки это меньше звонков посреди работы." : "Так меньше звонков посреди работы.";
  const early = opts.early ? ` Такая цена только для первых ${EARLY_CLIENTS} сервисов.` : "";
  return (
    `Здравствуйте! ${seen(b)}, а записаться онлайн к вам пока нельзя. Сделал для «${b.name}» сайт с записью, посмотрите: ${url}${styles}\n\n` +
    `Там ваш адрес и услуги. Клиент сам выбирает свободное время, а запись сразу приходит вам в телефон. ${less}\n\n` +
    `Подключение ${rub(SETUP_PRICE)}, первый месяц уже входит, дальше ${rub(MONTHLY_PRICE)} в месяц. Если за 2 недели не понравится, верну деньги.${early}\n\n` +
    `Если неактуально, напишите «нет», больше не побеспокою.\n\n${signature()}`
  );
}

/** Сообщение, которое импорт сохранил до 6 октября: оно писалось после ответа «да» и начинается со «Спасибо, что ответили». */
const OLD_DEFAULT = /^Спасибо, что ответили!/;

/** Сохранённое при импорте сообщение, если оно не старое «после ответа», иначе — новое по шаблону. */
export function demoMessage(saved: string | null | undefined, b: Biz, url: string, opts: { early?: boolean; now?: number } = {}) {
  return saved && !OLD_DEFAULT.test(saved) ? saved : outreach(b, url, opts);
}

/** Тема письма, когда пишем на почту. */
export const emailSubject = (b: { name: string }) => `Сайт с онлайн-записью для «${b.name}» уже готов`;

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
