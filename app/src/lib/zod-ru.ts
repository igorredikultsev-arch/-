// Сообщения проверки форм по-русски вместо английских «Invalid input». Подключается в серверных действиях.
import { z } from "zod";

z.config(z.locales.ru());

// Самые частые ошибки — простыми словами, без «ожидалось, что number будет <=1000000» из стандартного перевода
z.config({
  customError: (iss) => {
    if (iss.code === "too_big" && typeof iss.maximum !== "undefined") {
      return iss.origin === "string" ? `Слишком длинно: не больше ${iss.maximum} символов` : `Слишком большое число: не больше ${Number(iss.maximum).toLocaleString("ru-RU")}`;
    }
    if (iss.code === "too_small" && typeof iss.minimum !== "undefined") {
      return iss.origin === "string" ? (Number(iss.minimum) <= 1 ? "Заполните поле" : `Слишком коротко: не меньше ${iss.minimum} символов`) : `Слишком маленькое число: не меньше ${iss.minimum}`;
    }
    if (iss.code === "invalid_type" && iss.expected === "number") return "Нужно число";
    return undefined;
  },
});

/** Первая ошибка с названием поля: «Рейтинг: число от 1 до 5». */
export function firstIssue(error: z.ZodError, labels: Record<string, string> = {}): string {
  const i = error.issues[0];
  const key = String(i.path[0] ?? "");
  return labels[key] ? `${labels[key]}: ${i.message.replace(/^./, (c) => c.toLowerCase())}` : i.message;
}
