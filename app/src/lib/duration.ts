/** «около 40 минут», «около 21 минуты», «около часа», «около 1,5 ч» — длительность услуги для клиента. */
export function aboutDuration(m: number): string {
  if (m < 60) return `около ${m} ${m % 10 === 1 && m % 100 !== 11 ? "минуты" : "минут"}`;
  if (m === 60) return "около часа";
  return `около ${(m / 60).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ч`;
}
