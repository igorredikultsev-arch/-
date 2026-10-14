// Темы сайта автосервиса. Ключи совпадают с enum Theme в схеме базы.
export const THEME_KEYS = ["tire", "scan", "dots", "plan", "taxi"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

// Названия видят владельцы сервисов, поэтому они описывают вид сайта. Прежние названия (old) ещё
// принимаются в таблице для загрузки демо, чтобы старые таблицы не сломались.
// «Колесо», «Сканер», «Частицы» — тёмные стили с 3D-анимацией в первом экране (с 14 октября 2026, вместо «Тёмного»).
export const THEMES: { value: ThemeKey; label: string; old: string[]; accent: string; about: string }[] = [
  { value: "tire", label: "Колесо", old: ["Тёмный", "Боковина"], accent: "#2f7bff", about: "чёрный фон, 3D-колесо с названием сервиса собирается в первом экране" },
  { value: "scan", label: "Сканер", old: [], accent: "#ff3b30", about: "чёрный фон, 3D-машина на стенде, луч сканирует её, радиус и цена сразу" },
  { value: "dots", label: "Частицы", old: [], accent: "#7c5cff", about: "чёрный фон, шина из светящихся точек собирается и вращается" },
  { value: "plan", label: "Светлый", old: ["План"], accent: "#ffc400", about: "светлый фон, крупные буквы, свободное время клетками" },
  { value: "taxi", label: "Чёрно-белый", old: ["Такси"], accent: "#1f9d55", about: "белый фон, чёрные блоки, ближайшее свободное время" },
];

export const isThemeKey = (v: unknown): v is ThemeKey => typeof v === "string" && (THEME_KEYS as readonly string[]).includes(v);
export const themeAccent = (t: ThemeKey) => THEMES.find((x) => x.value === t)!.accent;
/** Стили с 3D-сценой в первом экране: тёмные, общая раскладка «витрины». */
export const isShowroom = (t: ThemeKey) => t === "tire" || t === "scan" || t === "dots";

/** Заголовок, которым proxy передаёт каркасу сайта стиль из ссылки ?theme= (предпросмотр в демо). */
export const THEME_HEADER = "x-site-theme";
