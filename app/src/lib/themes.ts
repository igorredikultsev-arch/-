// Темы сайта автосервиса. Ключи совпадают с enum Theme в схеме базы.
export const THEME_KEYS = ["tire", "plan", "taxi"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const THEMES: { value: ThemeKey; label: string; accent: string; about: string }[] = [
  { value: "tire", label: "Боковина", accent: "#f2c230", about: "тёмная, шина в шапке, цена по радиусу" },
  { value: "plan", label: "План", accent: "#ffc400", about: "светлая, запись на плане постов" },
  { value: "taxi", label: "Такси", accent: "#1f9d55", about: "чёрно-белая, загрузка постов на сегодня" },
];

export const isThemeKey = (v: unknown): v is ThemeKey => typeof v === "string" && (THEME_KEYS as readonly string[]).includes(v);
export const themeAccent = (t: ThemeKey) => THEMES.find((x) => x.value === t)!.accent;

/** Заголовок, которым proxy передаёт каркасу сайта стиль из ссылки ?theme= (предпросмотр в демо). */
export const THEME_HEADER = "x-site-theme";
