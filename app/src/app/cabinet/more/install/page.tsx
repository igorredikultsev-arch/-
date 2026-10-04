import { requireOwner } from "@/lib/auth";
import { SubHead } from "../../ui";

export default async function InstallPage() {
  await requireOwner();
  return (
    <>
      <SubHead back="/cabinet/more" backLabel="Ещё" title="Кабинет на экране телефона">
        Кабинет откроется с иконки, как приложение, без адресной строки. На iPhone без этого не работают уведомления.
      </SubHead>
      <div className="grid gap-3 px-[18px] lg:grid-cols-2 lg:px-0">
        {[
          { title: "iPhone", steps: ["Откройте кабинет в Safari.", "Нажмите «Поделиться» — квадрат со стрелкой вверх.", "Выберите «На экран Домой» и нажмите «Добавить».", "Откройте кабинет с новой иконки и войдите."] },
          { title: "Android", steps: ["Откройте кабинет в Chrome.", "Нажмите меню из трёх точек справа вверху.", "Выберите «Добавить на главный экран» или «Установить приложение».", "Откройте кабинет с новой иконки."] },
        ].map((p) => (
          <section key={p.title} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h2 className="text-[17px] font-bold">{p.title}</h2>
            <ol className="mt-2 grid list-decimal gap-2 pl-5 text-[15px] leading-snug text-zinc-700">
              {p.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
