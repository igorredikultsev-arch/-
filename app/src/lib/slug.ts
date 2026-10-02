const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};
const STOP = new Set(["шиномонтаж", "автосервис", "сто", "ооо", "ип", "автотехцентр", "сервис"]);

/** «Шиномонтаж „Колесо“» → «koleso». Служебные слова отбрасываются, если остаётся что-то ещё. */
export function slugify(name: string): string {
  const words = name.toLowerCase().replace(/[«»"'„“]/g, " ").split(/[^a-zа-яё0-9]+/i).filter(Boolean);
  const meaningful = words.filter((w) => !STOP.has(w));
  const use = meaningful.length ? meaningful : words;
  const s = use.join("-").split("").map((c) => MAP[c] ?? c).join("").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return (s || "servis").slice(0, 40);
}

export const RESERVED_SLUGS = new Set(["www", "app", "admin", "api", "cabinet", "mail", "login", "s"]);
