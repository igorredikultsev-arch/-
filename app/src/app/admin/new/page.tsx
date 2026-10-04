import { requireAdmin } from "@/lib/auth";
import { DemoForm } from "./demo-form";

export default async function NewDemoPage() {
  await requireAdmin();
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Новое демо</h1>
        <p className="mt-1 max-w-[65ch] text-[14px] text-zinc-600">
          Скопируйте данные из карточки на 2ГИС или Яндекс Картах. Фото и отзывы не копируем: у них есть авторы. Демо закрыто от поисковиков и уйдёт в архив через 14 дней, если сервис не подключить.
        </p>
      </div>
      <DemoForm />
    </div>
  );
}
