// Сообщения проверки форм по-русски вместо английских «Invalid input». Подключается в серверных действиях.
import { z } from "zod";

z.config(z.locales.ru());

/** Первая ошибка с названием поля: «Рейтинг: число от 1 до 5». */
export function firstIssue(error: z.ZodError, labels: Record<string, string> = {}): string {
  const i = error.issues[0];
  const key = String(i.path[0] ?? "");
  return labels[key] ? `${labels[key]}: ${i.message.replace(/^./, (c) => c.toLowerCase())}` : i.message;
}
