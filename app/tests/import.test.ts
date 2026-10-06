import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDemoRows } from "@/lib/demo-import";
import { demoMessage, outreach, reviewsText, withLink } from "@/lib/outreach";
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
    expect(b).toMatchObject({ phone: "+79000000003", city: "Пермь", rating: 4.5, theme: "taxi", accent: "#1f9d55", posts: 2, template: "tire" });
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
    expect(m).toBe("Здравствуйте!\n\nПример: https://avtoslot.ru/s/koleso\nТам ваши услуги.\nВверху можно переключить три варианта оформления и выбрать тот, что больше нравится.\n\nИгорь");
    expect(withLink("Привет, вот стиль сайта", "https://x")).toBe("Привет, вот стиль сайта\n\nhttps://x");
  });

  it("первое сообщение — сразу демо: ссылка, цена, отзывы из 2ГИС и отказ одним словом", () => {
    const b = { name: "Ось", rating: 4.8, reviews2gis: 173, twoGisUrl: "https://2gis.ru/perm/firm/1", yandexMapsUrl: null, status: "demo" };
    const oct = Date.UTC(2026, 9, 6, 12);
    const m = outreach(b, "https://avtoslot.ru/s/os", { early: true, now: oct });
    expect(m).toMatch(/^Здравствуйте! Увидел вас в 2ГИС: 4,8 и 173 отзыва, а записаться онлайн к вам пока нельзя\. Сделал для «Ось» сайт с записью, посмотрите: https:\/\/avtoslot\.ru\/s\/os\n/);
    expect(m).toContain("переключить три варианта оформления");
    expect(m).toContain("В сезон переобувки");
    expect(m).toMatch(/Подключение 3\s500\s₽, первый месяц уже входит, дальше 990\s₽ в месяц/);
    expect(m).toContain("только для первых 10 сервисов");
    expect(m).toContain("напишите «нет», больше не побеспокою");
    // Рейтинг ниже 4,7 не называем, «первых 10» — только пока цена действует, вне сезона без переобувки
    const low = outreach({ ...b, rating: 4.3, status: "active" }, "https://x", { now: Date.UTC(2026, 6, 1) });
    expect(low).toContain("Увидел вас в 2ГИС: 173 отзыва,");
    expect(low).not.toMatch(/4,3|первых|переобувки|оформления/);
    expect(outreach({ name: "Ось", rating: null, yandexMapsUrl: null }, "https://x")).toContain("Увидел ваш сервис на картах, а записаться");
  });

  it("старое сообщение «после ответа» из прошлого импорта заменяется новым, своё из таблицы остаётся", () => {
    const b = { name: "Ось", rating: null, yandexMapsUrl: null };
    expect(demoMessage("Спасибо, что ответили! Вот пример: https://x", b, "https://x")).toMatch(/^Здравствуйте!/);
    expect(demoMessage("Привет, вот сайт https://x", b, "https://x")).toBe("Привет, вот сайт https://x");
    expect(demoMessage(null, b, "https://x")).toMatch(/^Здравствуйте!/);
  });

  it("склоняет отзывы", () => {
    expect([1, 3, 11, 12, 21, 25, 104, 111].map(reviewsText)).toEqual(["1 отзыв", "3 отзыва", "11 отзывов", "12 отзывов", "21 отзыв", "25 отзывов", "104 отзыва", "111 отзывов"]);
  });
});
