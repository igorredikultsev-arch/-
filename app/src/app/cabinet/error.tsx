"use client";

// Сбой на экране кабинета (база не ответила, обрыв связи): понятное сообщение и повтор вместо общей страницы ошибки
export default function CabinetError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="grid gap-4 px-[18px] pt-10 lg:px-0">
      <h1 className="text-[26px] font-bold leading-tight tracking-tight">Не получилось загрузить</h1>
      <p className="max-w-prose text-[15px] leading-relaxed text-zinc-600">
        Похоже, пропала связь или сервер не ответил. Проверьте интернет и попробуйте ещё раз. Если повторяется, напишите нам, разберёмся.
      </p>
      <button type="button" onClick={() => retry()} className="inline-flex min-h-12 items-center justify-center justify-self-start rounded-xl bg-accent px-5 text-base font-semibold text-white">
        Попробовать ещё раз
      </button>
    </div>
  );
}
