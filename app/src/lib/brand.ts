// Telegram Автослота для связи: главная, вход, кабинет. Меняется здесь, а не в .env —
// так новый адрес попадает на сервер обычным обновлением
export const CONTACT_TELEGRAM = "avtoslot1";

// Контакты и ссылки для главной страницы avtoslot.ru. Почта и пример демо задаются в .env.
export function brandContacts() {
  const tg = CONTACT_TELEGRAM;
  const email = (process.env.PROCESSOR_EMAIL || "").trim();
  const example = (process.env.EXAMPLE_SLUG || "").trim();
  return {
    telegram: tg ? `https://t.me/${tg}` : null,
    telegramName: tg ? `@${tg}` : null,
    email: email || null,
    exampleUrl: example ? `/s/${example}` : null,
  };
}
