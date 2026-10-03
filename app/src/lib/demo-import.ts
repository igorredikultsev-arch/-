import { isHexColor } from "./color";
import { normalizePhone } from "./phone";
import { THEMES, themeAccent, type ThemeKey } from "./themes";
import type { Sheet } from "./sheet";
import type { TemplateKey } from "./templates";

// Разбор таблицы лидов для массового создания демо. Названия колонок как в форме «Новое демо»;
// лишние колонки не мешают, порядок любой.

export type DemoInput = {
  name: string;
  city: string;
  address: string;
  phone: string;
  yandexMapsUrl: string | null;
  twoGisUrl: string | null;
  rating: number | null;
  reviewsYandex: number | null;
  reviews2gis: number | null;
  template: TemplateKey;
  theme: ThemeKey;
  accent: string;
  posts: number;
  headline: string | null;
  channel: string | null;
  contact: string | null;
  notes: string | null;
  message: string | null;
};

export type ParsedRow = { line: number; name: string; demo?: DemoInput; error?: string };

type Field = "name" | "city" | "address" | "phone" | "yandex" | "twogis" | "rating" | "revYa" | "rev2gis" | "revAny" | "template" | "theme" | "accent" | "posts" | "headline" | "channel" | "contact" | "where" | "notes" | "message";

/** Колонка → поле. Заголовок сравнивается без регистра, скобок и лишних пробелов. */
function fieldOf(header: string): Field | null {
  const h = header.toLowerCase().replace(/\(.*?\)/g, " ").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  if (!h) return null;
  if (h.startsWith("первое сообщение") || h === "сообщение") return "message";
  if (h.includes("яндекс") && h.includes("отзыв")) return "revYa";
  if (h.includes("2гис") && h.includes("отзыв")) return "rev2gis";
  if (h.startsWith("отзыв")) return "revAny";
  if (h.includes("яндекс")) return "yandex";
  if (h.includes("2гис")) return "twogis";
  const exact: Record<string, Field> = {
    название: "name", город: "city", адрес: "address", телефон: "phone", рейтинг: "rating", "набор услуг": "template",
    тема: "theme", стиль: "theme", акцент: "accent", цвет: "accent", постов: "posts", заголовок: "headline", "канал связи": "channel", канал: "channel",
    контакт: "contact", "куда писать": "where", заметки: "notes", "что проверить": "notes", почему: "notes",
  };
  return exact[h] ?? null;
}

const num = (s: string) => {
  const n = Number(s.replace(",", ".").replace(/\s/g, ""));
  return s.trim() && Number.isFinite(n) ? n : null;
};
const int = (s: string) => {
  const n = num(s);
  return n != null && n >= 0 ? Math.round(n) : null;
};
const url = (s: string) => (/^https?:\/\/\S+$/i.test(s.trim()) ? s.trim() : null);

function theme(s: string): ThemeKey {
  const v = s.toLowerCase().trim();
  return THEMES.find((t) => t.label.toLowerCase() === v || t.value === v)?.value ?? "taxi";
}

/** «Telegram: t.me/x» из таблицы лидов → канал и контакт. */
function splitWhere(s: string) {
  const m = /^\s*([^:]{2,30}):\s*(.+)$/.exec(s);
  return m ? { channel: m[1].trim(), contact: m[2].trim() } : { channel: null, contact: s.trim() || null };
}

/** Ищет лист и строку заголовков (в них есть «Название» и «Адрес»). */
export function findTable(sheets: Sheet[]) {
  for (const s of sheets)
    for (let i = 0; i < Math.min(s.rows.length, 10); i++) {
      const fields = s.rows[i].map(fieldOf);
      if (fields.includes("name") && fields.includes("address")) return { sheet: s.name, headerAt: i, fields, rows: s.rows };
    }
  return null;
}

export function parseDemoRows(sheets: Sheet[], maxRows = 300): { sheet: string; rows: ParsedRow[] } | { error: string } {
  const t = findTable(sheets);
  if (!t) return { error: "Не нашёл заголовки. Нужны хотя бы колонки «Название», «Адрес» и «Телефон» в первой строке" };
  const body = t.rows.slice(t.headerAt + 1);
  const rows: ParsedRow[] = [];
  for (let i = 0; i < body.length && rows.length < maxRows; i++) {
    const cells = body[i];
    const get = (f: Field) => {
      const at = t.fields.indexOf(f);
      return at >= 0 ? String(cells[at] ?? "").trim() : "";
    };
    const name = get("name");
    if (!name) continue;
    const line = t.headerAt + i + 2;
    const address = get("address");
    if (address.length < 3) {
      rows.push({ line, name, error: "нет адреса" });
      continue;
    }
    const rawPhone = get("phone");
    if (!rawPhone) {
      rows.push({ line, name, error: "нет телефона" });
      continue;
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      rows.push({ line, name, error: `телефон «${rawPhone}» не похож на российский` });
      continue;
    }
    const where = get("where") ? splitWhere(get("where")) : { channel: null, contact: null };
    const th = theme(get("theme"));
    const accent = get("accent");
    const rating = num(get("rating"));
    const posts = int(get("posts"));
    rows.push({
      line,
      name,
      demo: {
        name: name.slice(0, 120),
        city: get("city") || "Пермь",
        address: address.slice(0, 200),
        phone,
        yandexMapsUrl: url(get("yandex")),
        twoGisUrl: url(get("twogis")),
        rating: rating != null && rating >= 1 && rating <= 5 ? Math.round(rating * 10) / 10 : null,
        reviewsYandex: int(get("revYa")),
        reviews2gis: int(get("rev2gis")) ?? int(get("revAny")),
        template: /экспресс|express/i.test(get("template")) ? "express" : "tire",
        theme: th,
        accent: isHexColor(accent) ? accent : themeAccent(th),
        posts: posts && posts >= 1 && posts <= 20 ? posts : 2,
        headline: get("headline").slice(0, 70) || null,
        channel: (get("channel") || where.channel || "").slice(0, 40) || null,
        contact: (get("contact") || where.contact || "").slice(0, 120) || null,
        notes: get("notes").slice(0, 2000) || null,
        message: get("message").slice(0, 4000) || null,
      },
    });
  }
  return { sheet: t.sheet, rows };
}
