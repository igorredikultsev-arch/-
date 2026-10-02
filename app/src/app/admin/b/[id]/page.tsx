import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { publicSiteUrl } from "@/lib/site-url";
import { deleteBusiness, extendDemo, setReceiptSent, setStatus } from "../../actions";
import { LEAD_LABEL, STATUS_CLS, STATUS_LABEL } from "../../labels";
import { btn2, CopyBox } from "../../ui";
import { InfoForm, LeadForm, PaymentForm, TrialForm } from "./forms";

const date = (d: Date | null) => (d ? d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "");

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
      <h2 className="text-[17px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Первое сообщение по шаблону из плана (раздел 8.3). Менять под каждого сервиса. */
function outreach(b: { name: string; rating: unknown; reviewsYandex: number | null; reviews2gis: number | null; yandexMapsUrl: string | null }, url: string) {
  const rating = b.rating ? Number(b.rating).toFixed(1).replace(".", ",") : null;
  const where = b.yandexMapsUrl ? "на Яндекс Картах" : "на 2ГИС";
  const intro = rating ? `Посмотрел ваш сервис ${where}: у вас ${rating}, но нет сайта с онлайн-записью, клиентам приходится звонить.` : `Посмотрел ваш сервис ${where}: у вас нет сайта с онлайн-записью, клиентам приходится звонить.`;
  return `Здравствуйте! ${intro}\n\nСделал для вас пример: ${url}\nТам ваши услуги, адрес и запись на свободное время. Клиент сам выбирает окно, а вы видите всё расписание в телефоне.\n\nПодключение 3 500 ₽, первые 2 недели бесплатно. Если неактуально, напишите, больше не побеспокою.`;
}

export default async function AdminBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const id = (await params).id;
  const created = (await searchParams).created === "1";
  const b = await db.business.findUnique({
    where: { id },
    include: { lead: true, users: true, payments: { orderBy: { createdAt: "desc" } }, _count: { select: { bookings: true } } },
  });
  if (!b) notFound();
  const siteUrl = publicSiteUrl(b.slug, b.customDomain);
  const loginUrl = `${process.env.APP_URL || "http://localhost:3000"}/login`;
  const siteBookings = await db.booking.count({ where: { businessId: id, source: "site" } });

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Link href="/admin" className="text-[14px] text-zinc-500">Все сервисы</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{b.name}</h1>
          <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${STATUS_CLS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
          {b.lead && <span className="text-[13px] text-zinc-500">{LEAD_LABEL[b.lead.status]}</span>}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-zinc-600">
          <a href={siteUrl} target="_blank" rel="noopener" className="font-semibold text-accent">{siteUrl.replace(/^https?:\/\//, "")}</a>
          <span>{formatPhone(b.phone)}</span>
          <span>Записей всего: {b._count.bookings}, с сайта: {siteBookings}</span>
          {b.status === "demo" && b.demoExpiresAt && <span>Демо до {date(b.demoExpiresAt)}</span>}
          {b.status === "trial" && b.trialEndsAt && <span>Пробный до {date(b.trialEndsAt)}</span>}
          {b.paidUntil && <span>Оплачено до {date(b.paidUntil)}</span>}
        </div>
      </div>

      {created && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-900">Демо создано. Откройте его, проверьте и отправьте владельцу.</p>}

      {(b.status === "demo" || b.lead?.status === "new") && (
        <Card title="Первое сообщение">
          <CopyBox label="Поправьте под сервис перед отправкой" rows={8} text={outreach(b, siteUrl)} />
          <p className="text-[13px] text-zinc-500">После отправки поставьте этап «Демо отправлено» ниже: так считается воронка.</p>
        </Card>
      )}

      <Card title="Воронка и заметки">
        <LeadForm id={b.id} lead={{ status: b.lead?.status ?? "new", channel: b.lead?.channel ?? "", contact: b.lead?.contact ?? "", notes: b.lead?.notes ?? "" }} />
      </Card>

      <Card title="Вход для владельца">
        {b.users.length > 0 && (
          <p className="text-[14px] text-zinc-600">Владелец: {b.users.map((u) => `${u.name ? `${u.name}, ` : ""}${formatPhone(u.phone)}`).join("; ")}</p>
        )}
        {!b.operatorName && b.status === "demo" && (
          <p className="rounded-xl bg-orange-50 px-3 py-2.5 text-[13.5px] text-orange-900">
            Перед запуском заполните реквизиты оператора персональных данных в блоке «Данные сервиса»: они попадают в согласие и политику на сайте.
          </p>
        )}
        <TrialForm id={b.id} loginUrl={loginUrl} siteUrl={siteUrl} hasOwner={b.users.length > 0} />
      </Card>

      <Card title="Оплаты">
        {b.payments.length > 0 && (
          <ul className="grid gap-1.5 text-[14px]">
            {b.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2">
                <span>
                  {date(p.createdAt)}: <b>{p.amount.toLocaleString("ru-RU")} ₽</b>, {p.purpose}
                  {p.periodTo ? `, до ${date(p.periodTo)}` : ""}
                </span>
                {p.receiptSent ? (
                  <span className="text-[12px] text-emerald-700">чек отправлен</span>
                ) : (
                  <form action={setReceiptSent.bind(null, p.id, b.id)}><button className="text-[12px] font-semibold text-orange-700 underline">чек не отправлен, отметить</button></form>
                )}
              </li>
            ))}
          </ul>
        )}
        <PaymentForm id={b.id} />
      </Card>

      <Card title="Данные сервиса">
        <InfoForm
          id={b.id}
          info={{
            name: b.name, city: b.city, address: b.address, phone: formatPhone(b.phone), yandexMapsUrl: b.yandexMapsUrl ?? "", twoGisUrl: b.twoGisUrl ?? "",
            rating: b.rating ? String(b.rating) : "", reviewsYandex: b.reviewsYandex?.toString() ?? "", reviews2gis: b.reviews2gis?.toString() ?? "",
            theme: b.theme, accent: b.accent, logoLetter: b.logoLetter ?? "", operatorName: b.operatorName ?? "", operatorInn: b.operatorInn ?? "", customDomain: b.customDomain ?? "",
          }}
        />
      </Card>

      <Card title="Статус">
        <div className="flex flex-wrap gap-2">
          {b.status === "demo" && <form action={extendDemo.bind(null, b.id)}><button className={btn2}>Продлить демо на 14 дней</button></form>}
          {b.status !== "active" && b.status !== "demo" && <form action={setStatus.bind(null, b.id, "active")}><button className={btn2}>Активировать</button></form>}
          {(b.status === "active" || b.status === "trial") && <form action={setStatus.bind(null, b.id, "suspended")}><button className={btn2}>Приостановить сайт</button></form>}
          {b.status !== "archived" && <form action={setStatus.bind(null, b.id, "archived")}><button className={btn2}>В архив</button></form>}
          {b.status === "archived" && <form action={setStatus.bind(null, b.id, "demo")}><button className={btn2}>Вернуть как демо</button></form>}
          {(b.status === "demo" || b.status === "archived") && (
            <details className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"><span className={`${btn2} !bg-red-50 !text-red-800`}>Удалить совсем</span></summary>
              <form action={deleteBusiness.bind(null, b.id)} className="mt-2 flex items-center gap-2 text-[14px]">
                Точно удалить сервис и все его записи?
                <button className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white">Да, удалить</button>
              </form>
            </details>
          )}
        </div>
        <p className="text-[13px] text-zinc-500">Приостановленный сайт показывает «Сайт временно недоступен» и номер телефона. Удаление стирает все записи сервиса без возможности восстановить.</p>
      </Card>
    </div>
  );
}
