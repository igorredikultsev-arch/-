import { SupportLink } from "../support";
import { ArrowSquareOut, CalendarX, ChatText, Clock, ImageSquare, ListBullets, QrCode, SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { hoursLines } from "@/lib/hours-text";
import { publicSiteUrl } from "@/lib/site-url";
import { formatDayLong, toLocal } from "@/lib/time";
import { Group, MenuRow, PageHead } from "../ui";

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

/** Раздел «Сайт»: превью шапки сайта и короткое меню, в каждой строке — что сейчас настроено. */
export default async function SitePage() {
  const { business: b } = await requireOwner();
  const [services, hidden, hours, nextDay] = await Promise.all([
    db.service.count({ where: { businessId: b.id } }),
    db.service.count({ where: { businessId: b.id, active: false } }),
    db.workingHours.findMany({ where: { businessId: b.id } }),
    db.dayException.findFirst({ where: { businessId: b.id, date: { gte: toLocal(Date.now(), b.timezone).date } }, orderBy: { date: "asc" } }),
  ]);
  const url = publicSiteUrl(b.slug, b.customDomain, b.status);
  const logo = b.logoAt ? `/s/${b.slug}/logo?v=${b.logoAt.getTime()}` : null;
  const step = b.slotStepMin === 60 ? "каждый час" : `каждые ${b.slotStepMin} мин`;
  return (
    <>
      <PageHead title="Сайт" />
      <div className="grid gap-5 px-3.5 lg:px-0">
        <a href={url} target="_blank" rel="noopener" className="group grid gap-3 rounded-[22px] bg-ink p-4 text-white">
          <div className="flex items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- логотип с нашего сайта
              <img src={logo} alt="" className="h-12 w-auto max-w-[96px] shrink-0 rounded-lg bg-white/5 object-contain" />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent text-[20px] font-bold">{b.name.replace(/^(Шиномонтаж|Автосервис)\s*/i, "").replace(/[«»"]/g, "").charAt(0) || "А"}</span>
            )}
            <span className="min-w-0">
              <b className="block truncate text-[16px]">{b.name}</b>
              <span className="block truncate text-[13.5px] text-white/60">{b.headline || "Запись онлайн без очереди"}</span>
            </span>
          </div>
          <span className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3.5 py-2.5 text-[14px]">
            <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            <span className="flex shrink-0 items-center gap-1.5 font-semibold group-hover:underline">Открыть <ArrowSquareOut size={16} /></span>
          </span>
        </a>

        <Group>
          <MenuRow href="/cabinet/site/link" icon={<QrCode size={22} />} title="Ссылка и QR-код" value="Для карт, табличек и мессенджеров" />
          <MenuRow href="/cabinet/site/logo" icon={<ImageSquare size={22} />} title="Логотип" value={b.logoAt ? "Загружен" : "Не загружен"} tone={b.logoAt ? undefined : "warn"} />
        </Group>

        <Group>
          <MenuRow href="/cabinet/site/services" icon={<ListBullets size={22} />} title="Услуги и цены" value={`${services} ${plural(services, "услуга", "услуги", "услуг")}${hidden ? `, скрыто ${hidden}` : ""}`} />
          <MenuRow href="/cabinet/site/hours" icon={<Clock size={22} />} title="Часы работы" value={hours.length ? hoursLines(hours).join(", ") : "Не заданы"} tone={hours.length ? undefined : "warn"} />
          <MenuRow href="/cabinet/site/days" icon={<CalendarX size={22} />} title="Праздники и особые дни" value={nextDay ? `Ближайший: ${formatDayLong(nextDay.date)}${nextDay.closed ? ", не работаем" : ""}` : "Не добавлены"} />
        </Group>

        <Group>
          <MenuRow href="/cabinet/site/texts" icon={<ChatText size={22} />} title="Тексты на сайте" value={b.headline || "Главная фраза, въезд, коротко о сервисе"} />
          <MenuRow href="/cabinet/site/rules" icon={<SlidersHorizontal size={22} />} title="Правила записи" value={`${b.posts} ${plural(b.posts, "пост", "поста", "постов")}, запись ${step}`} />
        </Group>

        <p className="px-1 text-[13px] leading-snug text-zinc-500">Цвет и оформление сайта меняем мы: <SupportLink>напишите</SupportLink>, если хотите другое.</p>
      </div>
    </>
  );
}
