"use client";

// Сбой в админке: что случилось и повтор, без общей страницы ошибки
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="grid gap-3 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Что-то пошло не так</h1>
      <p className="max-w-prose text-[15px] text-zinc-600">
        Действие не выполнилось: сервер не ответил или данные не прошли проверку. Обновите страницу и проверьте, сохранилось ли.
        {error.digest && <span className="block pt-1 text-[13px] text-zinc-400">Код для журнала сервера: {error.digest}</span>}
      </p>
      <button type="button" onClick={() => retry()} className="inline-flex min-h-11 items-center justify-center justify-self-start rounded-xl bg-accent px-4 text-[15px] font-semibold text-white">
        Попробовать ещё раз
      </button>
    </div>
  );
}
