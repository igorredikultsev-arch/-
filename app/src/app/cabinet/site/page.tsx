import Link from "next/link";
import QRCode from "qrcode";
import { CaretRight, DownloadSimple, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { readFacts } from "@/lib/business";
import { db } from "@/lib/db";
import { publicSiteUrl } from "@/lib/site-url";
import { formatDayLong, hhmm, toLocal } from "@/lib/time";
import { deleteException } from "../actions";
import { Card, PageHead, Section } from "../ui";
import { ExceptionForm, HoursForm, SettingsForm } from "./forms";
import { SiteLink } from "./site-link";

export default async function SiteEditPage() {
  const { business } = await requireOwner();
  const [services, hours, exceptions] = await Promise.all([
    db.service.findMany({ where: { businessId: business.id }, orderBy: [{ sortOrder: "asc" }] }),
    db.workingHours.findMany({ where: { businessId: business.id } }),
    db.dayException.findMany({ where: { businessId: business.id, date: { gte: toLocal(Date.now(), business.timezone).date } }, orderBy: { date: "asc" } }),
  ]);
  const siteUrl = publicSiteUrl(business.slug, business.customDomain, business.status);
  const qr = await QRCode.toString(siteUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const hoursRows = [1, 2, 3, 4, 5, 6, 7].map((wd) => {
    const h = hours.find((x) => x.weekday === wd);
    return {
      weekday: wd, closed: h ? h.closed : true, open: hhmm(h?.openMin ?? 540), close: hhmm(h?.closeMin ?? 1200),
      breakFrom: h?.breakFromMin != null ? hhmm(h.breakFromMin) : "", breakTo: h?.breakToMin != null ? hhmm(h.breakToMin) : "",
    };
  });
  return (
    <>
      <PageHead title="Сайт">
        <p className="mt-1 text-[13.5px] text-zinc-600">Цвет и оформление меняет администратор: напишите ему, если хотите другое.</p>
      </PageHead>

      <Section title="Ваш сайт">
        <Card className="grid gap-4 p-4">
          <SiteLink url={siteUrl} />
          <div className="flex items-center gap-4">
            {/* SVG собран на сервере библиотекой qrcode из адреса сайта */}
            <div className="size-32 shrink-0 rounded-xl border border-zinc-200 bg-white p-1.5" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="grid gap-2 text-[13.5px] leading-snug text-zinc-600">
              <p>QR-код для таблички у ворот, визиток и кассы: клиент наводит камеру и сразу попадает на запись.</p>
              <a href="/cabinet/qr" className="inline-flex items-center gap-1.5 font-semibold text-accent">
                <DownloadSimple size={16} /> Скачать для печати
              </a>
            </div>
          </div>
        </Card>
        <Card className="divide-y divide-zinc-100 text-[14px] leading-snug text-zinc-700">
          <details className="group px-4 py-3">
            <summary className="cursor-pointer list-none font-semibold text-ink">Как добавить сайт в Яндекс Карты</summary>
            <ol className="mt-2 grid list-decimal gap-1.5 pl-5">
              <li>Откройте Яндекс Бизнес (business.yandex.ru) под аккаунтом, к которому привязана карточка сервиса.</li>
              <li>Выберите свою организацию и откройте данные о ней: адрес, телефон, сайт.</li>
              <li>В поле «Сайт» вставьте адрес выше и сохраните. Если там можно настроить кнопку записи, укажите ту же ссылку.</li>
              <li>Изменения проверяет модерация Яндекса, обычно до нескольких дней.</li>
            </ol>
          </details>
          <details className="group px-4 py-3">
            <summary className="cursor-pointer list-none font-semibold text-ink">Как добавить сайт в 2ГИС</summary>
            <ol className="mt-2 grid list-decimal gap-1.5 pl-5">
              <li>Зайдите в личный кабинет 2ГИС для бизнеса, где управляете карточкой сервиса.</li>
              <li>В контактах организации добавьте сайт: вставьте адрес выше и сохраните.</li>
              <li>Если кабинета нет, откройте свою карточку в 2ГИС и предложите исправление: укажите сайт.</li>
              <li>Изменения проверяет модерация 2ГИС.</li>
            </ol>
          </details>
          <p className="px-4 py-3 text-zinc-600">Ещё места для ссылки: группа ВКонтакте, канал в MAX или Telegram, автоответ в мессенджерах, подпись на табличке. Названия пунктов в Яндексе и 2ГИС иногда меняются: если не нашли, напишите администратору.</p>
        </Card>
      </Section>

      <Section title="Услуги и цены" action={<Link href="/cabinet/site/service/new" className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent"><Plus size={16} />Добавить</Link>}>
        <Card className="divide-y divide-zinc-100">
          {services.map((s) => (
            <Link key={s.id} href={`/cabinet/site/service/${s.id}`} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <div className={s.active ? "" : "opacity-50"}>
                <div className="text-[14.5px] font-semibold">{s.name}</div>
                <div className="text-[12.5px] text-zinc-500">
                  {s.category}, {s.durationMin} мин{s.active ? "" : ", скрыта"}
                </div>
              </div>
              <span className="flex items-center gap-1 whitespace-nowrap text-[14px] font-semibold">
                {s.priceFrom ? `от ${s.priceFrom.toLocaleString("ru-RU")} ₽` : "бесплатно"} <CaretRight size={16} className="text-zinc-400" />
              </span>
            </Link>
          ))}
        </Card>
      </Section>

      <div id="hours" className="scroll-mt-4">
        <Section title="Часы работы и обед">
          <HoursForm hours={hoursRows} />
        </Section>
      </div>

      <Section title="Праздники и особые дни">
        {exceptions.map((e) => (
          <Card key={e.id} className="flex items-center justify-between p-3.5 text-[14px]">
            <span>
              <b>{formatDayLong(e.date)}</b>
              <span className="block text-zinc-500">{e.closed ? "не работаем" : `${hhmm(e.openMin ?? 0)}-${hhmm(e.closeMin ?? 0)}`}</span>
            </span>
            <form action={deleteException.bind(null, e.id)}>
              <button className="rounded-lg bg-zinc-100 px-3 py-2 text-[13px] font-semibold">Убрать</button>
            </form>
          </Card>
        ))}
        <ExceptionForm today={toLocal(Date.now(), business.timezone).date} />
      </Section>

      <Section title="Тексты и настройки записи">
        <SettingsForm
          s={{
            headline: business.headline ?? "",
            addressNote: business.addressNote ?? "",
            posts: business.posts,
            cancelHours: business.cancelHours,
            horizonDays: business.horizonDays,
            minLeadMin: business.minLeadMin,
            slotStepMin: business.slotStepMin,
            facts: readFacts(business.facts),
          }}
        />
      </Section>
    </>
  );
}
