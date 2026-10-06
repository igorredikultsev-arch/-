export const LEAD_LABEL = {
  new: "Новый",
  asked: "Спросили, ждём ответа",
  demo_sent: "Демо отправлено",
  replied: "Ответил",
  interested: "Интересно",
  trial: "Подключён, ждёт оплату",
  paid: "Платит",
  refused: "Отказ",
} as const;

export const STATUS_LABEL = {
  demo: "Демо",
  trial: "Пробный (старый)",
  active: "Активен",
  suspended: "Приостановлен",
  archived: "Архив",
} as const;

export const STATUS_CLS = {
  demo: "bg-zinc-100 text-zinc-700",
  trial: "bg-sky-50 text-sky-800",
  active: "bg-emerald-50 text-emerald-800",
  suspended: "bg-orange-50 text-orange-800",
  archived: "bg-zinc-100 text-zinc-500",
} as const;

export { THEMES } from "@/lib/themes";

/**
 * Можно ли удалить сервис галочкой из списка: только демо и архив, как и кнопкой в карточке.
 * Отказы не удаляем пачкой: карточка с отметкой «отказ» нужна, чтобы не написать повторно (политика, п. 3.3),
 * её стирает очистка через 12 месяцев. Удалить отказ раньше можно в карточке сервиса, «Управление».
 */
export function canBulkDelete(status: string, lead: string | null | undefined) {
  return (status === "demo" || status === "archived") && lead !== "refused";
}
