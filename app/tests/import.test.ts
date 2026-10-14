import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDemoRows } from "@/lib/demo-import";
import { afterDemo, REPLIES, demoMessage, followUps, outreach, priceText, question, QUESTION_NAMES, questionVariant, reviewsText, withLink } from "@/lib/outreach";
import { readCsv, readTable } from "@/lib/sheet";

describe("импорт демо из таблицы", () => {
  it("читает xlsx: находит лист с заголовками, пропускает пустые строки и строки без телефона", () => {
    const buf = readFileSync(path.join(import.meta.dirname, "fixtures/leads.xlsx"));
    const res = parseDemoRows(readTable(buf, "leads.xlsx"));
    if ("error" in res) throw new Error(res.error);
    expect(res.sheet).toBe("Для демо");
    expect(res.rows.map((r) => [r.line, r.name, r.error ?? "ok"])).toEqual([
      [2, "Шиномонтаж «Колесо»", "ok"],
      [3, "Без телефона", "нет телефона"],
      [5, "Шина & Диск", "ok"],
    ]);
    const a = res.rows[0].demo!;
    expect(a).toMatchObject({ phone: "+79000000001", city: "Пермь", twoGisUrl: "https://2gis.ru/perm/firm/1", rating: 4.7, reviews2gis: 120, theme: "plan", accent: "#ffc400", posts: 3, channel: "Telegram", contact: "t.me/koleso" });
    expect(a.message).toContain("[ссылка на демо]");
    const b = res.rows[2].demo!;
    expect(b).toMatchObject({ phone: "+79000000003", city: "Пермь", rating: 4.5, theme: "dots", accent: "#7c5cff", posts: 2, template: "tire" });
  });

  it("читает csv из Excel в кодировке Windows-1251 с точкой с запятой и кавычками", () => {
    const text = 'Название;Адрес;Телефон;Куда писать\r\n"Шиномонтаж ""Ось""";ул. Ленина, 5;8 900 000-00-05;Telegram: t.me/os\r\n';
    const cp1251 = Buffer.from(new Uint8Array([...text].map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 0x410 && code <= 0x44f) return code - 0x410 + 0xc0;
      return code;
    })));
    const res = parseDemoRows(readCsv(cp1251));
    if ("error" in res) throw new Error(res.error);
    expect(res.rows[0].demo).toMatchObject({ name: 'Шиномонтаж "Ось"', address: "ул. Ленина, 5", phone: "+79000000005", channel: "Telegram", contact: "t.me/os" });
  });

  it("без нужных колонок отвечает понятной ошибкой", () => {
    expect(parseDemoRows(readCsv(Buffer.from("a,b\n1,2\n")))).toEqual({ error: expect.stringContaining("Название") });
  });

  it("подставляет ссылку в сообщение и добавляет фразу про оформление в конец абзаца", () => {
    const m = withLink("Здравствуйте!\n\nПример: [ссылка на демо]\nТам ваши услуги.\n\nИгорь", "https://avtoslot.ru/s/koleso");
    expect(m).toBe("Здравствуйте!\n\nПример: https://avtoslot.ru/s/koleso\nТам ваши услуги.\nСверху можно переключить оформление, там пять вариантов.\n\nИгорь");
    expect(withLink("Привет, вот стиль сайта", "https://x")).toBe("Привет, вот стиль сайта\n\nhttps://x");
  });

  it("первое сообщение — короткий вопрос: три разных текста, без ссылки и цены, с отказом и подписью", () => {
    const b = { name: "Ось", slug: "os", rating: 4.8, reviews2gis: 173, twoGisUrl: "https://2gis.ru/perm/firm/1", yandexMapsUrl: null, status: "demo" };
    const oct = Date.UTC(2026, 9, 6, 12);
    const july = Date.UTC(2026, 6, 1, 12);
    const texts = QUESTION_NAMES.flatMap((_, variant) => [question(b, { now: oct, variant }), question(b, { now: july, variant })]);
    expect(QUESTION_NAMES).toHaveLength(3);
    expect(new Set(texts.filter((_, i) => i % 2 === 0)).size).toBe(3);
    for (const m of texts) {
      // Ни ссылки, ни адреса сайта, ни цены: это вопрос, а не реклама
      expect(m).not.toMatch(/https?:|avtoslot|\.ru|₽|руб/);
      expect(m).not.toContain("Ось");
      expect(m).toContain("?");
      expect(m).toMatch(/онлайн-запис/);
      expect(m).toMatch(/больше не (потревожу|напишу)/);
      // Без подписи: имя и так видно в мессенджере
      expect(m).not.toMatch(/Автослот|Игорь/);
      expect(m.split(/\s+/).length).toBeLessThanOrEqual(60);
      // Без тире: по ним текст сразу выдаёт нейросеть
      expect(m).not.toMatch(/[—–]/);
    }
    expect(question(b, { variant: 1 })).toContain("в 2ГИС, у вас рейтинг 4,8 и 173 отзыва");
    expect(question({ ...b, rating: 4.3, reviews2gis: null }, { variant: 1 })).not.toMatch(/4,3|у вас рейтинг/);
    expect(question(b, { now: oct, variant: 2 })).toMatch(/сезон/);
    expect(question(b, { now: july, variant: 2 })).not.toMatch(/сезон/);
    // У одного сервиса вариант всегда один и тот же, у разных — разный
    expect(question(b)).toBe(question(b));
    const used = new Set(["os", "koleso", "shina", "disk", "balans", "pit", "r16", "tihaya", "chajka", "kord"].map(questionVariant));
    expect(used.size).toBe(3);
    expect(question(b, { now: oct })).toBe(question(b, { now: oct, variant: questionVariant("os") }));
  });

  it("второе сообщение — демо со ссылкой, цена отдельно, повторные без ссылки", () => {
    const b = { name: "Ось", slug: "os", rating: null, yandexMapsUrl: null, status: "demo" };
    const demo = outreach(b, "https://avtoslot.ru/s/os");
    expect(demo).toContain("https://avtoslot.ru/s/os");
    expect(demo).toContain("оформление");
    expect(demo).not.toMatch(/₽/);
    expect(outreach({ ...b, status: "active" }, "https://x")).not.toMatch(/оформлени/);
    expect(priceText({ early: true })).toMatch(/3\s500\s₽.*990\s₽.*первых 10.*верну/s);
    expect(priceText()).not.toMatch(/первых/);
    const [second, last] = followUps(b, { now: Date.UTC(2026, 9, 6) });
    expect(second).not.toMatch(/https?:/);
    expect(second).toMatch(/\?$/);
    expect(last).toMatch(/Последний раз/);
    expect(last).toMatch(/сезона/);
    expect(followUps(b, { now: Date.UTC(2026, 6, 1) })[1]).not.toMatch(/сезон/);
    for (const m of [demo, priceText({ early: true }), second, last, afterDemo(), ...REPLIES.map((r) => r.text)]) expect(m).not.toMatch(/[—–]/);
    // Ответы на возражения без ссылок и без обещаний, что все начнут записываться
    for (const r of REPLIES) expect(r.text).not.toMatch(/https?:|все (начнут|будут)/);
  });

  it("сообщения с демо, которые импорт сохранил по старым шаблонам, заменяются текущим, своё из таблицы остаётся", () => {
    const b = { name: "Ось", rating: null, yandexMapsUrl: null };
    expect(demoMessage("Спасибо, что ответили! Вот пример: https://x", b, "https://x")).toBe(outreach(b, "https://x"));
    expect(demoMessage("Здравствуйте! Увидел вас в 2ГИС: 4,9 и 173 отзыва, а записаться…", b, "https://x")).toBe(outreach(b, "https://x"));
    expect(demoMessage("Привет, вот сайт https://x", b, "https://x")).toBe("Привет, вот сайт https://x");
    expect(demoMessage(null, b, "https://x")).toBe(outreach(b, "https://x"));
  });

  it("склоняет отзывы", () => {
    expect([1, 3, 11, 12, 21, 25, 104, 111].map(reviewsText)).toEqual(["1 отзыв", "3 отзыва", "11 отзывов", "12 отзывов", "21 отзыв", "25 отзывов", "104 отзыва", "111 отзывов"]);
  });
});
