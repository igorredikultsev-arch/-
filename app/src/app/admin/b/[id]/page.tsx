import { isKnownCity } from "@/lib/timezone";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { earlyPrice } from "@/lib/business";
import { demoMessage, emailSubject } from "@/lib/outreach";
import { formatPhone } from "@/lib/phone";
import { connectFirst, operatorMissing, TERMINATE_AFTER_DAYS, terminationDue } from "@/lib/readiness";
import { processor } from "@/lib/legal";
import { rknDraft } from "@/lib/rkn";
import { publicSiteUrl } from "@/lib/site-url";
import { SETUP_PRICE, UNPAID_GRACE_DAYS, rub } from "@/lib/pricing";
import { deleteBusiness, extendDemo, openCabinet, setReceiptSent, setStatus } from "../../actions";
import { LEAD_LABEL, STATUS_CLS, STATUS_LABEL, THEMES } from "../../labels";
import { btn2, CopyBox } from "../../ui";
import { InfoForm, LeadForm, PaymentForm, RknForm, TrialForm } from "./forms";

const date = (d: Date | null) => (d ? d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "");

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
      <h2 className="text-[17px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

const TABS = [
  { key: "work", label: "Переписка" },
  { key: "connect", label: "Подключение" },
  { key: "pay", label: "Оплаты" },
  { key: "info", label: "Данные" },
  { key: "manage", label: "Управление" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Biz = NonNullable<Awaited<ReturnType<typeof load>>>;

const load = (id: string) =>
  db.business.findUnique({
    where: { id },
    include: { lead: true, users: true, payments: { orderBy: { createdAt: "desc" } }, _count: { select: { bookings: true } } },
  });

const day = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

/** Что сделать с сервисом дальше: одна подсказка и вкладка, где это делается. */
function nextStep(b: Biz): { text: string; tab: Tab; tone: "do" | "wait" | "ok" | "bad" } {
  const lead = b.lead?.status ?? "new";
  const due = terminationDue(b);
  if (due) {
    return {
      text: `Сайт приостановлен больше ${TERMINATE_AFTER_DAYS} дней: по оферте договор расторгнут (п. 4.2). До ${day(due.deleteBy)} удалите данные сайта и клиентов: «В архив», затем «Удалить совсем». Владельцу отправьте акт об уничтожении (п. 7.7).`,
      tab: "manage",
      tone: "bad",
    };
  }
  if (b.status === "archived") return { text: "Сервис в архиве. Вернуть его можно во вкладке «Управление».", tab: "manage", tone: "wait" };
  if (b.status === "suspended") return { text: "Сайт приостановлен. Когда владелец оплатит, запишите оплату — сайт включится.", tab: "pay", tone: "bad" };
  if (b.status === "demo") {
    if (lead === "new") return { text: "Проверьте демо, отправьте владельцу сообщение со ссылкой и поставьте этап «Демо отправлено».", tab: "work", tone: "do" };
    // «Спросили» остался у лидов, которым писали по-старому, до 6 октября
    if (lead === "asked") return { text: "Ждём ответа на вопрос. Ответили «да» — отправьте демо, «нет» — поставьте «Отказ».", tab: "work", tone: "wait" };
    if (lead === "refused") return { text: "Владелец отказался. Можно отправить в архив.", tab: "manage", tone: "wait" };
    if (operatorMissing({ ...b, status: "active" })) return { text: "Ждём ответа. Чтобы подключить, понадобятся ФИО или название ИП и ИНН владельца.", tab: "info", tone: "wait" };
    return { text: "Владелец согласен? Создайте ему вход и подключите сервис.", tab: "connect", tone: "do" };
  }
  if (!b.payments.length) {
    const off = b.paidUntil ? day(new Date(b.paidUntil.getTime() + UNPAID_GRACE_DAYS * 86400000)) : "";
    return { text: `Запишите оплату подключения ${rub(SETUP_PRICE)}.${off ? ` Без неё сайт приостановится ${off}.` : ""}`, tab: "pay", tone: "do" };
  }
  if (b.status !== "trial" && !b.offerAcceptedAt) return { text: "Владелец ещё не принял оферту: попросите его войти в кабинет, там появится галочка.", tab: "connect", tone: "wait" };
  if (!b.rknFiledAt) return { text: "Перешлите владельцу черновик уведомления в Роскомнадзор и отметьте, когда он подаст.", tab: "connect", tone: "do" };
  if (b.paidUntil && b.paidUntil.getTime() < Date.now() + 3 * 86400000) return { text: `Оплачено до ${day(b.paidUntil)}. Напомните владельцу об оплате.`, tab: "pay", tone: "do" };
  return { text: "Всё в порядке: сайт работает, оплачено, документы на месте.", tab: "work", tone: "ok" };
}

const TONE = {
  do: "bg-accent text-white",
  wait: "bg-white ring-1 ring-zinc-200",
  ok: "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200",
  bad: "bg-red-50 text-red-900 ring-1 ring-red-200",
};

export default async function AdminBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; tab?: string }> }) {
  await requireAdmin();
  const id = (await params).id;
  const sp = await searchParams;
  const created = sp.created === "1";
  const b = await load(id);
  if (!b) notFound();
  const step = nextStep(b);
  const lead = b.lead?.status ?? "new";
  // Вкладка всегда в адресе: иначе после сохранения формы «что сделать дальше» пересчитывается, страница
  // перепрыгивает на другую вкладку, и пропадают «Сохранено» и одноразовый пароль владельца
  if (!TABS.some((t) => t.key === sp.tab)) redirect(`/admin/b/${id}?tab=${step.tab}${created ? "&created=1" : ""}`);
  const tab = sp.tab as Tab;
  const siteUrl = publicSiteUrl(b.slug, b.customDomain, b.status);
  // Демо или архивное демо без владельца: оплату и «Активировать» не показываем, сначала «Создать вход»
  const payBlocked = connectFirst({ status: b.status, owners: b.users.filter((u) => u.role === "owner").length });
  const loginUrl = `${process.env.APP_URL || "http://localhost:3000"}/login`;
  const [siteBookings, early] = await Promise.all([db.booking.count({ where: { businessId: id, source: "site" } }), earlyPrice()]);
  const facts: [string, React.ReactNode][] = [
    ["Телефон", formatPhone(b.phone)],
    ["Записей", `${b._count.bookings}, с сайта ${siteBookings}`],
    ...(b.status === "demo" && b.demoExpiresAt ? [["Демо до", date(b.demoExpiresAt)] as [string, string]] : []),
    ...(b.status === "trial" && b.trialEndsAt ? [["Пробный до", date(b.trialEndsAt)] as [string, string]] : []),
    ...(b.paidUntil ? [["Оплачено до", date(b.paidUntil)] as [string, string]] : []),
    ...(b.status !== "demo" ? [["Оферта", b.offerAcceptedAt ? `принята ${date(b.offerAcceptedAt)}` : "не принята"] as [string, string]] : []),
    ...(b.status !== "demo" ? [["Роскомнадзор", b.rknFiledAt ? `подано ${date(b.rknFiledAt)}` : "не отмечено"] as [string, string]] : []),
    ["Стиль", <>{THEMES.find((t) => t.value === b.theme)?.label}{b.themeChosenAt && <span className="text-emerald-700">, выбрал владелец</span>}</>],
    ...(b.lead?.channel || b.lead?.contact ? [["Связь", [b.lead?.channel, b.lead?.contact].filter(Boolean).join(": ")] as [string, string]] : []),
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Link href="/admin" className="-ml-1 inline-flex items-center gap-1 justify-self-start text-[14px] font-semibold text-zinc-500 hover:text-ink"><CaretLeft size={16} /> Все сервисы</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">{b.name}</h1>
          <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS_CLS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
          {b.lead && <span className="text-[13px] text-zinc-500">{LEAD_LABEL[b.lead.status]}</span>}
        </div>
        <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="justify-self-start text-[14.5px] font-semibold text-accent hover:underline">{siteUrl.replace(/^https?:\/\//, "")}</a>
      </div>

      {created && b.status === "demo" && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-900">Демо создано. Откройте и проверьте его, потом отправьте владельцу сообщение со ссылкой.</p>}

      <Link href={`/admin/b/${b.id}?tab=${step.tab}`} className={`grid gap-1 rounded-2xl px-5 py-4 ${TONE[step.tone]}`}>
        <span className={`text-[13px] font-semibold ${step.tone === "do" ? "text-white" : "text-zinc-500"}`}>Что сделать дальше</span>
        <span className="text-[16px] font-semibold leading-snug">{step.text}</span>
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="grid gap-4">
          <nav aria-label="Разделы сервиса" className="-mx-4 flex gap-1 overflow-x-auto border-b border-zinc-200 px-4 sm:mx-0 sm:px-0">
            {TABS.map((t) => (
              <Link key={t.key} href={`/admin/b/${b.id}?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14.5px] ${t.key === tab ? "border-accent font-semibold text-ink" : "border-transparent text-zinc-500 hover:text-ink"}`}>
                {t.label}
              </Link>
            ))}
          </nav>

          {tab === "work" && (
            <>
              {b.status === "demo" && lead !== "refused" && (
                <Card title={lead === "new" ? "Первое сообщение: демо" : "Сообщение с демо"}>
                  <CopyBox label="Поправьте под сервис перед отправкой" rows={10} text={demoMessage(b.lead?.firstMessage, b, siteUrl, { early })} />
                  {/@/.test(b.lead?.contact ?? "") && <CopyBox label="Тема письма" rows={2} text={emailSubject(b)} />}
                  <p className="text-[13px] text-zinc-500">
                    Пишите на официальный номер, почту или в сообщество сервиса, а не на личную страницу владельца. После отправки поставьте этап «Демо отправлено». Ответили «нет» — поставьте «Отказ» и больше не пишите.
                  </p>
                </Card>
              )}
              <Card title="Этап и заметки">
                {/* key: после подключения или оплаты этап меняется на сервере, а при отказе стирается контакт: форма должна показать новое,
                    а не затереть старым. Простое сохранение заметок форму не пересоздаёт, и «Сохранено» остаётся видно */}
                <LeadForm key={`${b.id}-${b.lead?.status}-${b.lead?.contact ?? ""}`} id={b.id} lead={{ status: b.lead?.status ?? "new", channel: b.lead?.channel ?? "", contact: b.lead?.contact ?? "", notes: b.lead?.notes ?? "" }} />
              </Card>
            </>
          )}

          {tab === "connect" && (
            <>
              <Card title="Вход для владельца">
                {b.users.length > 0 && (
                  <p className="text-[14px] text-zinc-600">Владелец: {b.users.map((u) => `${u.name ? `${u.name}, ` : ""}${formatPhone(u.phone)}`).join("; ")}</p>
                )}
                {operatorMissing(b) && b.status !== "archived" && (
                  <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[13.5px] font-medium text-red-800">
                    Онлайн-запись на сайте выключена: не заполнены «Оператор ПДн» и «ИНН оператора» во вкладке «Данные». Клиенты видят «позвоните в сервис».
                  </p>
                )}
                {(!b.operatorName || !b.operatorInn) && (b.status === "demo" || b.status === "archived") && (
                  <p className="rounded-xl bg-orange-50 px-3 py-2.5 text-[13.5px] text-orange-900">
                    Чтобы подключить сервис, заполните «Оператор ПДн» и «ИНН оператора» во вкладке «Данные»: они попадают в согласие клиента на сайте.
                  </p>
                )}
                <TrialForm id={b.id} loginUrl={loginUrl} siteUrl={siteUrl} hasOwner={b.users.length > 0} />
              </Card>
              <Card title="Кабинет владельца">
                <p className="text-[14px] text-zinc-600">Внести услуги, цены, часы и логотип за владельца, например при подключении. Пароль владельца не нужен.</p>
                <form action={openCabinet.bind(null, b.id)}>
                  <button className={btn2}>Открыть кабинет владельца</button>
                </form>
              </Card>
              {b.status !== "demo" && (
                <Card title="Уведомление в Роскомнадзор">
                  <p className="text-[14px] leading-snug text-zinc-600">
                    Сервис — оператор данных своих клиентов и сам подаёт уведомление, до начала онлайн-записи (штраф для ИП и ООО за неподачу — 100–300 тыс. ₽).
                    Перешлите владельцу черновик: в нём готовые ответы на поля формы. Это черновик, его стоит показать юристу.
                  </p>
                  <CopyBox label="Черновик для владельца" rows={10} text={rknDraft(b, processor(), date(b.payments.reduce<Date>((min, p) => (p.createdAt < min ? p.createdAt : min), new Date())))} />
                  <RknForm key={b.id} id={b.id} filedAt={b.rknFiledAt ? b.rknFiledAt.toISOString().slice(0, 10) : ""} number={b.rknNumber ?? ""} />
                </Card>
              )}
            </>
          )}

          {tab === "pay" && (
            <Card title="Оплаты">
              {b.payments.length > 0 ? (
                <ul className="grid gap-1.5 text-[14px]">
                  {b.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2.5">
                      <span>
                        {date(p.createdAt)}: <b>{p.amount.toLocaleString("ru-RU")} ₽</b>, {p.purpose}
                        {p.periodTo ? `, до ${date(p.periodTo)}` : ""}
                      </span>
                      {p.receiptSent ? (
                        <span className="text-[12.5px] text-emerald-700">чек отправлен</span>
                      ) : (
                        <form action={setReceiptSent.bind(null, p.id, b.id)}><button className="text-[12.5px] font-semibold text-orange-700 underline">чек не отправлен, отметить</button></form>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-zinc-500">Оплат пока нет.</p>
              )}
              {payBlocked ? (
                <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-[14px] text-amber-900">
                  {payBlocked}.{" "}
                  <Link href={`/admin/b/${b.id}?tab=connect`} className="font-semibold underline">Открыть «Подключение»</Link>
                </p>
              ) : (
                <PaymentForm id={b.id} />
              )}
            </Card>
          )}

          {tab === "info" && (
            <Card title="Данные сервиса">
              <InfoForm
                key={b.id} // не updatedAt: иначе после сохранения форма пересоздаётся и «Сохранено» пропадает, не успев показаться
                id={b.id}
                info={{
                  name: b.name, city: b.city, address: b.address, phone: formatPhone(b.phone), yandexMapsUrl: b.yandexMapsUrl ?? "", twoGisUrl: b.twoGisUrl ?? "",
                  rating: b.rating ? String(b.rating) : "", reviewsYandex: b.reviewsYandex?.toString() ?? "", reviews2gis: b.reviews2gis?.toString() ?? "",
                  theme: b.theme, accent: b.accent, operatorName: b.operatorName ?? "", operatorInn: b.operatorInn ?? "", customDomain: b.customDomain ?? "",
                  timezone: b.timezone, knownCity: isKnownCity(b.city),
                }}
              />
            </Card>
          )}

          {tab === "manage" && (
            <Card title="Статус сайта">
              <div className="flex flex-wrap gap-2">
                {b.status === "demo" && <form action={extendDemo.bind(null, b.id)}><button className={btn2}>Продлить демо на 14 дней</button></form>}
                {b.status !== "active" && b.status !== "demo" && !payBlocked && <form action={setStatus.bind(null, b.id, "active")}><button className={btn2}>Активировать</button></form>}
                {(b.status === "active" || b.status === "trial") && <form action={setStatus.bind(null, b.id, "suspended")}><button className={btn2}>Приостановить сайт</button></form>}
                {b.status !== "archived" && <form action={setStatus.bind(null, b.id, "archived")}><button className={btn2}>В архив</button></form>}
                {b.status === "archived" && <form action={setStatus.bind(null, b.id, "demo")}><button className={btn2}>Вернуть как демо</button></form>}
                {(b.status === "demo" || b.status === "archived") && (
                  <details className="group">
                    <summary className={`${btn2} cursor-pointer list-none !bg-red-50 !text-red-800 hover:!bg-red-100 [&::-webkit-details-marker]:hidden`}>Удалить совсем</summary>
                    <form action={deleteBusiness.bind(null, b.id)} className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
                      Точно удалить сервис и все его записи?
                      <button className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white">Да, удалить</button>
                    </form>
                  </details>
                )}
              </div>
              <p className="text-[13px] text-zinc-500">Приостановленный сайт показывает «Сайт временно недоступен» и номер телефона. Удаление стирает все записи сервиса без возможности восстановить.</p>
            </Card>
          )}
        </div>

        <aside className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 lg:sticky lg:top-20">
          <h2 className="text-[13px] font-semibold text-zinc-500">Коротко</h2>
          <dl className="grid gap-2 text-[14px]">
            {facts.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="min-w-0 break-words font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
