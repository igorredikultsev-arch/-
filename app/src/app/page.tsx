import type { Metadata } from "next";
import Link from "next/link";
import { brandContacts } from "@/lib/brand";
import { processor } from "@/lib/legal";
import { GUARANTEE_DAYS, MONTHLY_PRICE, SETUP_PRICE, rub } from "@/lib/pricing";
import "./landing.css";

// Контакты и реквизиты берутся из .env на сервере, поэтому страница собирается при каждом запросе
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Автослот — онлайн-запись для шиномонтажа и автосервиса",
  description: "Сайт, на котором клиенты сами записываются на свободное время, а записи приходят владельцу в телефон. Подключение за один день.",
};

const OPEN = 600; // 10:00
const SPAN = 480; // до 18:00
type Slot = { from: string; to: string; kind?: "lunch" | "new" };
const POSTS: Slot[][] = [
  [{ from: "10:00", to: "10:40" }, { from: "11:00", to: "11:50" }, { from: "13:00", to: "14:00", kind: "lunch" }, { from: "14:30", to: "15:10", kind: "new" }, { from: "16:00", to: "16:40" }],
  [{ from: "10:00", to: "11:00" }, { from: "11:30", to: "12:10" }, { from: "13:00", to: "14:00", kind: "lunch" }, { from: "15:00", to: "15:50" }, { from: "16:30", to: "17:30" }],
];
const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const pos = (s: Slot) => ({ left: `${((min(s.from) - OPEN) / SPAN) * 100}%`, width: `${((min(s.to) - min(s.from)) / SPAN) * 100}%` });

const STEPS = [
  { h: "Присылаю пример", p: "Собираю сайт по вашей карточке в 2ГИС или на Яндекс Картах: услуги, цены, адрес, часы работы. Вы смотрите и решаете, ничего не платя." },
  { h: "Сверяем услуги и время", p: "В переписке уточняем цены, сколько длится каждая работа и сколько у вас постов. Обычно это полчаса." },
  { h: "Подключаем и ставите ссылку", p: "Оплачиваете подключение, получаете вход в кабинет. Ссылку ставите в карточку на картах, во ВКонтакте, на табличку у ворот, и клиенты начинают записываться." },
];

const FEATURES = [
  { h: "Только свободное время", p: "Сайт учитывает число постов, длительность работ, обед и выходные. Два клиента на одно окно не попадут." },
  { h: "Записи приходят в телефон", p: "Уведомление о каждой новой записи и отмене, утром — сводка на день. Кабинет открывается в браузере, ставить ничего не нужно." },
  { h: "Звонки в то же расписание", p: "Записали клиента по телефону, внесли в кабинет за десять секунд. Сайт сразу закроет это время." },
  { h: "Отмена без звонка", p: "Не получается приехать? Клиент отменяет запись по ссылке, и время снова становится свободным." },
  { h: "Цены меняете сами", p: "Услуги, цены, часы работы, праздники и логотип правятся в кабинете с телефона. Изменения сразу на сайте." },
  { h: "Видно, что сайт работает", p: "В кабинете статистика: сколько клиентов записались сами, на какие услуги и на какую сумму." },
];

// Частые вопросы владельцев (раздел 8.4 плана): ответ прямо на странице, до переписки
const FAQ = [
  { q: "Мои клиенты не будут записываться онлайн", a: "Все и не нужно. Многие звонят, но часть клиентов записывается вечером, когда вы уже не берёте трубку. Даже пять таких записей в месяц окупают сервис, а звонки вы вносите в то же расписание." },
  { q: "Кто будет этим заниматься?", a: "Сайт работает сам: записи приходят вам в телефон, свободное время считается автоматически. Поменять цену или закрыть день — минута в кабинете. Если что-то непонятно, помогаю в переписке." },
  { q: "Нужно ли покупать домен, хостинг, программы?", a: "Нет. Сайт получает адрес вида ваш-сервис.avtoslot.ru, всё остальное уже работает. Кабинет открывается в браузере телефона или компьютера." },
  { q: "А как с законом о персональных данных?", a: "На сайте есть согласие клиента, политика и ваши реквизиты, данные хранятся на сервере в России. Уведомление в Роскомнадзор подаёт сам сервис: присылаю готовый текст, это около 20 минут на сайте РКН." },
  { q: "Что если не понравится?", a: `Напишите в течение ${GUARANTEE_DAYS} дней после подключения, и я верну деньги полностью, без объяснения причин.` },
];

export default function Home() {
  const c = brandContacts();
  const pr = processor();
  const contactHref = c.telegram ?? (c.email ? `mailto:${c.email}` : null);
  const contactLabel = c.telegram ? "Написать в Telegram" : "Написать на почту";

  return (
    <div className="landing min-h-dvh bg-paper text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-white" aria-hidden="true">А</span>
          Автослот
        </Link>
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold text-zinc-700 ring-1 ring-zinc-300 hover:bg-white">
          Вход в кабинет
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-12">
          <div className="grid gap-6">
            <h1 className="hero-title">Клиенты записываются сами, пока вы работаете</h1>
            <p className="max-w-[34rem] text-[18px] leading-relaxed text-zinc-700">
              Сайт с онлайн-записью для шиномонтажа и автосервиса. Клиент выбирает услугу и свободное время, а запись сразу появляется у вас в телефоне.
            </p>
            <div className="flex flex-wrap gap-3">
              {contactHref && (
                <a href={contactHref} className="rounded-2xl bg-accent px-6 py-4 text-[16px] font-semibold text-white shadow-[0_8px_24px_-10px_#ff6a1f] hover:brightness-105">
                  {contactLabel}
                </a>
              )}
              {c.exampleUrl && (
                <Link href={c.exampleUrl} className="rounded-2xl bg-white px-6 py-4 text-[16px] font-semibold ring-1 ring-zinc-300 hover:ring-zinc-400">
                  Посмотреть пример сайта
                </Link>
              )}
            </div>
            <p className="text-[15px] leading-snug text-zinc-600">
              Пример сайта для вашего сервиса — бесплатно. Подключение {rub(SETUP_PRICE)}, дальше {rub(MONTHLY_PRICE)} в месяц. Не понравится за {GUARANTEE_DAYS} дней — верну деньги.
            </p>
          </div>

          <figure className="board" aria-label="Пример расписания в кабинете владельца: два поста, обед, новая запись с сайта на 14:30">
            <div className="board-head">
              <b>Суббота, 18 октября</b>
              <span>10:00–18:00</span>
            </div>
            <div className="grid gap-2">
              {POSTS.map((post, i) => (
                <div key={i} className="board-row">
                  <span className="board-label">Пост {i + 1}</span>
                  <div className="board-lane">
                    {post.map((s) => (
                      <i key={s.from} className={`board-slot ${s.kind ? `is-${s.kind}` : ""}`} style={pos(s)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="board-hours" aria-hidden="true">
              <span />
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i}>{10 + i}</span>
              ))}
            </div>
            <figcaption className="board-push">
              <span className="board-push-icon" aria-hidden="true">А</span>
              <span>
                <b>Новая запись с сайта</b>
                Суббота, 14:30, смена колёс <span className="whitespace-nowrap">R13–R16</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="border-t border-zinc-300/70 bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-14 lg:py-20">
            <h2 className="section-title">Как подключиться</h2>
            <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
              {STEPS.map((s, i) => (
                <li key={s.h} className="grid content-start gap-2">
                  <span className="step-num" aria-hidden="true">{i + 1}</span>
                  <h3 className="text-[18px] font-bold tracking-tight">{s.h}</h3>
                  <p className="leading-relaxed text-zinc-600">{s.p}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-14 lg:py-20">
          <h2 className="section-title">Что умеет</h2>
          <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.h} className="grid gap-1.5 border-l-[3px] border-accent pl-4">
                <h3 className="text-[17px] font-bold tracking-tight">{f.h}</h3>
                <p className="leading-relaxed text-zinc-600">{f.p}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="price">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-14 lg:py-20">
            <h2 className="section-title">Сколько стоит</h2>
            <div className="grid gap-8">
              <div className="grid gap-8 sm:grid-cols-2">
                <div className="grid gap-1">
                  <p className="price-num">{rub(SETUP_PRICE)}</p>
                  <p className="text-zinc-300">подключение, в него входит первый месяц</p>
                </div>
                <div className="grid gap-1">
                  <p className="price-num">{rub(MONTHLY_PRICE)}</p>
                  <p className="text-zinc-300">в месяц со второго месяца: сайт, кабинет и поддержка</p>
                </div>
              </div>
              <p className="max-w-[36rem] text-[18px] leading-relaxed text-white">
                Если за {GUARANTEE_DAYS} дней не понравится, верну деньги полностью. Одна переобувка окупает месяц.
              </p>
              {contactHref && (
                <a href={contactHref} className="justify-self-start rounded-2xl bg-accent px-6 py-4 text-[16px] font-semibold text-white hover:brightness-105">
                  {c.telegram ? `Написать ${c.telegramName}` : `Написать на ${c.email}`}
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-14 lg:py-20">
          <h2 className="section-title">Частые вопросы</h2>
          <div className="grid gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="faq group rounded-2xl bg-white ring-1 ring-zinc-200">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[17px] font-bold tracking-tight">
                  {f.q}
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-[20px] font-semibold transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-zinc-600">{f.a}</p>
              </details>
            ))}
            {contactHref && (
              <p className="pt-3 text-[16px] text-zinc-700">
                Не нашли ответ?{" "}
                <a href={contactHref} className="font-semibold text-ink underline underline-offset-4">
                  {c.telegram ? `Напишите в Telegram ${c.telegramName}` : `Напишите на ${c.email}`}
                </a>
                , обычно отвечаю в тот же день.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="mx-auto grid max-w-6xl gap-4 px-4 py-10 text-[14px] text-zinc-600 sm:px-8">
        <p>
          Автослот. {pr.name}, самозанятый, ИНН {pr.inn}.{c.email && <> Почта: <a className="underline underline-offset-4" href={`mailto:${c.email}`}>{c.email}</a>.</>}
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Документы">
          <Link className="underline underline-offset-4" href="/offer">Договор-оферта</Link>
          <Link className="underline underline-offset-4" href="/privacy">Политика обработки данных</Link>
          <Link className="underline underline-offset-4" href="/login">Вход в кабинет</Link>
        </nav>
      </footer>
    </div>
  );
}
