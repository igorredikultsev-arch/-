// Разделы и цены услуг для сайта, кабинета и импорта.
// Раздел может быть с подразделом: «Развал-схождение / Седан» — на сайте раздел раскрывается, внутри подразделы с ценами.

export const SUB_SEP = " / ";

/** «Развал-схождение / Седан» → ["Развал-схождение", "Седан"]; без подраздела — [раздел, null]. */
export function splitCategory(category: string): [string, string | null] {
  const i = category.indexOf(SUB_SEP);
  return i < 0 ? [category, null] : [category.slice(0, i), category.slice(i + SUB_SEP.length)];
}

/** «от 1 200 ₽», «1 200 ₽» (цена точная), «после осмотра»; 0 с точной ценой — «бесплатно». */
export function priceText(priceFrom: number, priceExact = false): string {
  if (priceFrom <= 0) return priceExact ? "бесплатно" : "после осмотра";
  return `${priceExact ? "" : "от "}${priceFrom.toLocaleString("ru-RU")} ₽`;
}
