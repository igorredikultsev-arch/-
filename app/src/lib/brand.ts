// Контакты и ссылки для главной страницы avtoslot.ru. Всё необязательное, задаётся в .env.
export function brandContacts() {
  const tg = (process.env.CONTACT_TELEGRAM || "").trim().replace(/^@/, "");
  const email = (process.env.PROCESSOR_EMAIL || "").trim();
  const example = (process.env.EXAMPLE_SLUG || "").trim();
  return {
    telegram: tg ? `https://t.me/${tg}` : null,
    telegramName: tg ? `@${tg}` : null,
    email: email || null,
    exampleUrl: example ? `/s/${example}` : null,
  };
}
