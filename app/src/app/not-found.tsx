import Link from "next/link";

// Любая несуществующая страница: по-русски и со ссылкой на главную вместо английской заглушки Next.js
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-100 px-4 text-center">
      <div className="grid max-w-md gap-3">
        <p className="text-[13px] font-semibold tracking-wide text-zinc-500">ОШИБКА 404</p>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">Такой страницы нет</h1>
        <p className="text-[15px] text-zinc-600">Возможно, ссылка устарела или в ней опечатка. Проверьте адрес или откройте главную страницу.</p>
        <Link href="/" className="justify-self-center rounded-xl bg-white px-5 py-3 text-[15px] font-semibold ring-1 ring-zinc-300">
          На главную
        </Link>
      </div>
    </main>
  );
}
