import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDemoRows } from "@/lib/demo-import";
import { outreach, question, withLink } from "@/lib/outreach";
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

  it("первое сообщение — только вопрос: без ссылки и цен; ссылка и цены — во втором", () => {
    const b = { name: "Ось", rating: 4.8, yandexMapsUrl: "https://yandex.ru/maps/org/1", status: "demo" };
    const q = question(b);
    expect(q).toContain("у вас 4,8");
    expect(q).toContain("Можно прислать ссылку и условия?");
    expect(q).not.toMatch(/https?:\/\/|₽/);
    const m = outreach(b, "https://avtoslot.ru/s/os");
    expect(m).toContain("https://avtoslot.ru/s/os");
    expect(m).toMatch(/3\s500\s₽/);
  });
});
