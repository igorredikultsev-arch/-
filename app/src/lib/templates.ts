// Типовые наборы для быстрого демо (раздел 2.3 плана). Владелец потом правит цены в кабинете.

export type ServiceTemplate = { category: string; name: string; description?: string; priceFrom: number; durationMin: number; isDiagnostic?: boolean };

export const TIRE_SERVICES: ServiceTemplate[] = [
  { category: "Шиномонтаж", name: "Смена колёс R13-R16", description: "Снять, разбортировать, отбалансировать", priceFrom: 1600, durationMin: 40 },
  { category: "Шиномонтаж", name: "Смена колёс R17-R19", description: "Кроссоверы и крупные седаны", priceFrom: 2200, durationMin: 50 },
  { category: "Шиномонтаж", name: "Смена колёс R20 и больше", description: "Внедорожники и низкий профиль", priceFrom: 3000, durationMin: 60 },
  { category: "Шиномонтаж", name: "Балансировка 4 колёс", priceFrom: 800, durationMin: 30 },
  { category: "Шиномонтаж", name: "Ремонт прокола", priceFrom: 400, durationMin: 30 },
  { category: "Развал", name: "Развал-схождение", description: "Проверка и регулировка углов", priceFrom: 1500, durationMin: 60 },
  { category: "ТО и масло", name: "Замена масла в двигателе", description: "Масло клиента или наше", priceFrom: 600, durationMin: 30 },
  { category: "Диагностика", name: "Диагностика ходовой", description: "Опишите, что беспокоит", priceFrom: 0, durationMin: 30, isDiagnostic: true },
];

export const EXPRESS_SERVICES: ServiceTemplate[] = [
  { category: "ТО и масло", name: "Замена масла в двигателе", priceFrom: 600, durationMin: 30 },
  { category: "ТО и масло", name: "ТО с заменой фильтров", priceFrom: 2500, durationMin: 90 },
  { category: "Тормоза", name: "Замена тормозных колодок", description: "Одна ось", priceFrom: 1200, durationMin: 60 },
  { category: "Развал", name: "Развал-схождение", priceFrom: 1500, durationMin: 60 },
  { category: "Кондиционер", name: "Заправка кондиционера", priceFrom: 2000, durationMin: 60 },
  { category: "Диагностика", name: "Компьютерная диагностика", description: "Опишите, что беспокоит", priceFrom: 1000, durationMin: 30, isDiagnostic: true },
];

export const TEMPLATES = { tire: { label: "Шиномонтаж", services: TIRE_SERVICES }, express: { label: "Экспресс-сервис", services: EXPRESS_SERVICES } } as const;
export type TemplateKey = keyof typeof TEMPLATES;

/** Пн-Сб 9:00-20:00, Вс выходной */
export const DEFAULT_HOURS = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  closed: weekday === 7,
  openMin: weekday === 6 ? 600 : 540,
  closeMin: weekday === 6 ? 1080 : 1200,
}));

export const DEFAULT_FACTS = [
  { value: "2 поста", label: "можно приехать вдвоём" },
  { value: "R13-R22", label: "любые диаметры" },
];
