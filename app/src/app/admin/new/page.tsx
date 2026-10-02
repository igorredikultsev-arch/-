import { DemoForm } from "./demo-form";

export default function NewDemoPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Новое демо</h1>
        <p className="mt-1 max-w-[65ch] text-[14px] text-zinc-600">
          Скопируйте данные из карточки на 2ГИС или Яндекс Картах. Фото и отзывы не копируем: у них есть авторы. Демо закрыто от поисковиков и удалится через 14 дней, если не перевести его в пробный период.
        </p>
      </div>
      <DemoForm />
    </div>
  );
}
