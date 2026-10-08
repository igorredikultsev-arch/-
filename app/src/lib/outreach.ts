// Сообщение владельцу (раздел 8.3 плана). Менять под каждого сервиса.
// С 6 октября 2026 (решение Игоря) демо отправляем сразу, первым сообщением: со ссылкой и ценой.
// Юридическая проверка 5 октября советовала сначала спрашивать «можно прислать?» (ст. 15 152-ФЗ) — риск принят осознанно.
// Пишем на официальный номер или в сообщество сервиса, а не на личный аккаунт владельца. После отказа больше не пишем.
import { MONTHLY_PRICE, rub, SETUP_PRICE, EARLY_CLIENTS } from "./pricing";
import { toLocal } from "./time";

export const STYLES = "Сверху можно переключить оформление, там три варианта.";

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

const domain = () => process.env.ROOT_DOMAIN || "avtoslot.ru";
/** Подпись: кто пишет и откуда (личное деловое предложение, а не безымянная рассылка — раздел 6.6 плана). */
export const signature = () => `Игорь, Автослот, ${domain()}`;

/** 1 отзыв, 3 отзыва, 25 отзывов */
export function reviewsText(n: number) {
  const n10 = n % 10, n100 = n % 100;
  const word = n10 === 1 && n100 !== 11 ? "отзыв" : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? "отзыва" : "отзывов";
  return `${n} ${word}`;
}

/** Где нашли сервис и что о нём сказать: «рейтинг 4,9 и 173 отзыва». Рейтинг называем только от 4,7. */
function card(b: Biz) {
  const gis = !!b.twoGisUrl || (!b.yandexMapsUrl && b.reviews2gis != null);
  const where = gis ? "в 2ГИС" : b.yandexMapsUrl ? "на Яндекс Картах" : "на картах";
  const reviews = gis ? b.reviews2gis : b.reviewsYandex;
  const rating = b.rating != null && Number(b.rating) >= 4.7 ? `рейтинг ${String(Math.round(Number(b.rating) * 10) / 10).replace(".", ",")}` : null;
  const facts = [rating, reviews ? reviewsText(reviews) : null].filter(Boolean).join(" и ") || null;
  return { where, facts };
}

/** Сезон переобувки: октябрь–ноябрь и март–апрель. */
function inSeason(nowMs: number, tz: string) {
  const month = Number(toLocal(nowMs, tz).date.slice(5, 7));
  return [3, 4, 10, 11].includes(month);
}

type Ctx = {
  name: string; url: string; where: string; facts: string | null;
  styles: boolean; season: boolean; early: boolean; setup: string; monthly: string; n: number; domain: string;
};

/**
 * Пять вариантов первого сообщения. Разный текст разным сервисам: одинаковые сообщения
 * Telegram быстрее считает рассылкой, а владельцы соседних сервисов могут переслать друг другу.
 * Пишем как человек в переписке: коротко, без рекламных оборотов.
 */
const VARIANTS: ((c: Ctx) => string)[] = [
  (c) =>
    `Здравствуйте! Нашёл «${c.name}» ${c.where}${c.facts ? `, у вас ${c.facts}` : ""}, а онлайн-записи нет. Собрал вам сайт, где клиент сам выбирает время: ${c.url}` +
    (c.styles ? "\nОформление можно переключить сверху, там три варианта." : "") +
    `\n\nПодключение ${c.setup}, первый месяц уже в этой сумме, дальше ${c.monthly} в месяц. Если за две недели не понравится, верну деньги.` +
    (c.early ? ` Такая цена только для первых ${c.n} сервисов.` : "") +
    `\n\nЕсли неинтересно, просто напишите, больше не буду беспокоить.\n\nИгорь, Автослот, ${c.domain}`,
  (c) =>
    `Добрый день! Сделал для «${c.name}» сайт с онлайн-записью, посмотрите: ${c.url}` +
    (c.styles ? "\nСверху можно поменять оформление." : "") +
    `\n\nКлиенты сами выбирают свободное время, заявка сразу приходит вам на телефон.` +
    (c.season ? " В сезон переобувки звонков станет заметно меньше." : "") +
    `\n\nСтоит ${c.setup} за подключение вместе с первым месяцем, потом ${c.monthly} в месяц. Не подойдёт за 14 дней, верну всю сумму.` +
    (c.early ? ` Цена действует для первых ${c.n} сервисов.` : "") +
    `\n\nЕсли неактуально, напишите, я больше не потревожу.\nИгорь, Автослот (${c.domain})`,
  (c) =>
    `Здравствуйте. ${c.facts ? `Посмотрел карточку «${c.name}» ${c.where}: ${c.facts}. Онлайн-записи у вас я не нашёл` : `Онлайн-записи у «${c.name}» я не нашёл`}, поэтому сделал пример сайта с записью: ${c.url}` +
    `\nАдрес и услуги там уже ваши${c.styles ? ", а вверху есть три варианта оформления" : ""}.` +
    `\n\nПо цене: ${c.setup} за подключение, в них входит первый месяц, дальше ${c.monthly} в месяц. Две недели можно пользоваться и вернуть деньги, если не понравится.` +
    (c.early ? ` Это цена для первых ${c.n} клиентов.` : "") +
    `\n\nЕсли неактуально, ответьте «нет», больше писать не буду.\n\nИгорь, Автослот, ${c.domain}`,
  (c) =>
    `Добрый день! Меня зовут Игорь, делаю сайты с онлайн-записью для шиномонтажей и автосервисов. Для «${c.name}» уже собрал, вот: ${c.url}` +
    `\n\nКлиент открывает сайт, выбирает время и записывается, а вы видите запись у себя в телефоне.` +
    (c.season ? " Сейчас сезон, так что телефон будет меньше разрываться." : "") +
    `\n\nПодключение ${c.setup}, в него входит первый месяц. Со второго месяца ${c.monthly}. Если за две недели поймёте, что не нужно, верну деньги.` +
    (c.early ? ` Цена такая для первых ${c.n} сервисов.` : "") +
    `\n\nНеинтересно? Напишите, больше не побеспокою.\nАвтослот, ${c.domain}`,
  (c) =>
    `Здравствуйте! ${c.facts ? `У «${c.name}» ${c.facts} ${c.where}, а записаться онлайн нельзя.` : `У «${c.name}» пока нет онлайн-записи.`} Я сделал вам сайт с записью, можете посмотреть: ${c.url}` +
    (c.styles ? "\nСверху переключается оформление, выберите, какое больше нравится." : "") +
    `\n\nКлиент сам выбирает свободное окно, а вам приходит уведомление.` +
    `\n\n${c.setup} за подключение (первый месяц включён), потом ${c.monthly} в месяц. Деньги верну, если в течение двух недель передумаете.` +
    (c.early ? ` Для первых ${c.n} сервисов цена именно такая, потом будет выше.` : "") +
    `\n\nЕсли не нужно, просто ответьте «нет», больше не напишу.\nИгорь, Автослот, ${c.domain}`,
];
export const OUTREACH_VARIANTS = VARIANTS.length;

/** Номер варианта по ссылке на демо: у одного сервиса текст всегда один и тот же. */
function pick(key: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % VARIANTS.length;
}

/**
 * Первое сообщение: сразу ссылка на демо и цена, чтобы не думали, что это сайт за 20 тысяч.
 * early — подключение ещё по цене для первых клиентов (меньше EARLY_CLIENTS оплативших).
 * variant — номер варианта (для проверки); по умолчанию выбирается по ссылке.
 */
export function outreach(b: Biz, url: string, opts: { early?: boolean; now?: number; variant?: number } = {}) {
  const { where, facts } = card(b);
  return VARIANTS[opts.variant ?? pick(url)]({
    name: b.name, url, where, facts,
    styles: b.status === "demo",
    season: inSeason(opts.now ?? Date.now(), b.timezone || "Asia/Yekaterinburg"),
    early: !!opts.early, setup: rub(SETUP_PRICE), monthly: rub(MONTHLY_PRICE), n: EARLY_CLIENTS, domain: domain(),
  });
}

/**
 * Сообщения, которые импорт раньше сохранял сам по шаблону: «Спасибо, что ответили!» (до 6 октября)
 * и «Здравствуйте! Увидел вас…» (6–8 октября). Вместо них показываем текущий шаблон.
 */
const OLD_GENERATED = /^(Спасибо, что ответили!|Здравствуйте! Увидел (вас|ваш сервис) )/;

/** Своё сообщение из таблицы, если было; иначе — по текущему шаблону. */
export function demoMessage(saved: string | null | undefined, b: Biz, url: string, opts: { early?: boolean; now?: number } = {}) {
  return saved && !OLD_GENERATED.test(saved) ? saved : outreach(b, url, opts);
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
