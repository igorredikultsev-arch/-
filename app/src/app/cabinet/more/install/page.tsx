import { requireViewer } from "@/lib/auth";
import { SubHead } from "../../ui";

export default async function InstallPage() {
  const { readOnly } = await requireViewer();
  return (
    <>
      <SubHead back={readOnly ? "/cabinet/week" : "/cabinet/more"} backLabel={readOnly ? "Календарь" : "Ещё"} title="Кабинет на экране телефона">
        Это не отдельное приложение из магазина, а ваш кабинет: он откроется с иконки, как приложение, без адресной строки. На iPhone без этого не работают уведомления.
      </SubHead>
      <div className="grid gap-3 px-[18px] lg:grid-cols-2 lg:px-0">
        {[
          { title: "iPhone", steps: ["Откройте кабинет в Safari.", "Нажмите «Поделиться» — квадрат со стрелкой вверх.", "Выберите «На экран Домой» и нажмите «Добавить».", "Откройте кабинет с новой иконки и войдите."] },
          { title: "Android", steps: ["Откройте кабинет в Chrome.", "Нажмите меню из трёх точек справа вверху.", "Выберите «Добавить на главный экран» или «Установить приложение».", "Откройте кабинет с новой иконки."] },
          { title: "Android без Chrome", steps: ["Откройте кабинет в Яндекс Браузере или Samsung Internet.", "Откройте меню браузера.", "Выберите «Добавить ярлык» или «На главный экран» — в разных браузерах пункт называется по-разному.", "Откройте кабинет с новой иконки."] },
          { title: "Компьютер", steps: ["Откройте кабинет в Chrome, Edge или Яндекс Браузере.", "Нажмите значок установки справа в адресной строке или «Установить» в меню браузера.", "Кабинет появится в меню «Пуск» и на панели задач, как программа.", "Если пункта нет — добавьте кабинет в закладки и закрепите вкладку."] },
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
