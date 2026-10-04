// Темы сайта автосервиса. Ключи совпадают с enum Theme в схеме базы.
export const THEME_KEYS = ["tire", "plan", "taxi"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

// Названия видят владельцы сервисов, поэтому они описывают вид сайта. Прежние рабочие названия (old) ещё
// принимаются в таблице для загрузки демо, чтобы старые таблицы не сломались.
export const THEMES: { value: ThemeKey; label: string; old: string; accent: string; about: string }[] = [
  { value: "tire", label: "Тёмный", old: "Боковина", accent: "#f2c230", about: "тёмный фон, колесо в шапке, цена по радиусу" },
  { value: "plan", label: "Светлый", old: "План", accent: "#ffc400", about: "светлый фон, крупные буквы, свободное время клетками" },
  { value: "taxi", label: "Чёрно-белый", old: "Такси", accent: "#1f9d55", about: "белый фон, чёрные блоки, ближайшее свободное время" },
];

export const isThemeKey = (v: unknown): v is ThemeKey => typeof v === "string" && (THEME_KEYS as readonly string[]).includes(v);
export const themeAccent = (t: ThemeKey) => THEMES.find((x) => x.value === t)!.accent;

/** Заголовок, которым proxy передаёт каркасу сайта стиль из ссылки ?theme= (предпросмотр в демо). */
export const THEME_HEADER = "x-site-theme";
