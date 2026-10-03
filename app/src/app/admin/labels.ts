export const LEAD_LABEL = {
  new: "Новый",
  demo_sent: "Демо отправлено",
  replied: "Ответил",
  interested: "Интересно",
  trial: "Пробный период",
  paid: "Платит",
  refused: "Отказ",
} as const;

export const STATUS_LABEL = {
  demo: "Демо",
  trial: "Пробный",
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
