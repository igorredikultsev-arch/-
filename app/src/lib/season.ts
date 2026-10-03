import { toLocal } from "./time";

/** Плашка сезона на сайте шиномонтажа: октябрь–ноябрь — зимняя резина, март–апрель — летняя. */
export function seasonNotice(nowMs: number, tz: string): { title: string; text: string } | null {
  const month = Number(toLocal(nowMs, tz).date.slice(5, 7));
  if (month === 10 || month === 11)
    return { title: "Сезон зимней резины", text: "В сезон бывают очереди. Выберите свободное время заранее, запись занимает минуту." };
  if (month === 3 || month === 4)
    return { title: "Сезон летней резины", text: "В сезон бывают очереди. Выберите свободное время заранее, запись занимает минуту." };
  return null;
}
