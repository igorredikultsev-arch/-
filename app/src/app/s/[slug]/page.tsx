import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NavigationArrow, Phone, Snowflake, Star, Sun } from "@phosphor-icons/react/dist/ssr";
import { getSiteBusiness, isExampleSlug, isPublic, readFacts, shortName, type SiteBusiness, decodeKey } from "@/lib/business";
import { captchaClientKey } from "@/lib/captcha";
import { formatPhone } from "@/lib/phone";
import { seasonNotice } from "@/lib/season";
import { routeUrl, siteBase } from "@/lib/site-url";
import { resolveDayWindow } from "@/lib/slots";
import { hoursLines } from "@/lib/hours-text";
import { logoSrc } from "@/lib/logo";
import { hhmm, toLocal } from "@/lib/time";
import { radiusBands, radiusList } from "@/lib/radius";
import { isThemeKey, type ThemeKey } from "@/lib/themes";
import { operatorMissing } from "@/lib/readiness";
import { BookingWidget, type WidgetService } from "./booking-widget";
import { DayLoad } from "./day-load";
import { PostsPlan } from "./posts-plan";
import { RadiusPicker } from "./radius-picker";
import { ServicesList } from "./services-list";
import { ThemeSwitch } from "./theme-switch";
import { TireArt } from "./tire-art";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ theme?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = decodeKey((await params).slug);
  const biz = await getSiteBusiness(key);
  if (!biz) return {};
  const logo = logoSrc(await siteBase(key), biz.logoAt);
  return {
    // Логотип сервиса — значок вкладки браузера; без него остаётся общий значок
    ...(logo ? { icons: { icon: logo, apple: logo } } : {}),
    title: `${biz.name}: онлайн-запись`,
    description: `${biz.name}, ${biz.city}, ${biz.address}. Запись на свободное время без звонка.`,
    // Превью ссылки в мессенджерах (демо владельцу присылают сообщением, клиентам — ссылкой из карточки на картах)
    openGraph: {
      title: `${biz.name}: онлайн-запись`,
      description: `${biz.city}, ${biz.address}. Выберите услугу и свободное время, запись за минуту.`,
      siteName: biz.name,
      type: "website",
      locale: "ru_RU",
    },
    // Демо не индексируется (раздел 6.7 плана)
    robots: biz.status === "demo" || biz.status === "archived" ? { index: false, follow: false } : undefined,
  };
}

/** «Открыто до 20:00» или «Обед до 14:00» с учётом праздников и сокращённых дней. */
function openNow(biz: Pick<SiteBusiness, "timezone" | "hours" | "exceptions">) {
  const now = toLocal(Date.now(), biz.timezone);
  const w = resolveDayWindow(now.date, biz.hours, biz.exceptions);
  if (!w || now.minutes < w.openMin || now.minutes >= w.closeMin) return null;
  if (w.breakFrom != null && w.breakTo != null && now.minutes >= w.breakFrom && now.minutes < w.breakTo) return `Обед до ${hhmm(w.breakTo)}`;
  return `Открыто до ${hhmm(w.closeMin)}`;
}

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

export default async function SitePage({ params, searchParams }: Props) {
  const key = decodeKey((await params).slug);
  const biz = await getSiteBusiness(key);
  // Макет тоже отвечает «не найдено», но страница рисуется параллельно с ним и не должна падать
  if (!biz) notFound();
  if (!isPublic(biz.status)) return <p className="closed-note">Сайт временно недоступен. Позвоните в сервис: {formatPhone(biz.phone)}</p>;
  const base = await siteBase(key);
  const apiBase = `/api/s/${encodeURIComponent(key)}`;
  // Плашка про сезон резины — только у тех, кто меняет резину
  const season = biz.services.some((s) => s.category.toLowerCase().includes("шиномонтаж")) ? seasonNotice(Date.now(), biz.timezone) : null;
  const facts = readFacts(biz.facts);
  const reviews = (biz.reviewsYandex ?? 0) + (biz.reviews2gis ?? 0);
  const rating = biz.rating ? Number(biz.rating).toFixed(1).replace(".", ",") : null;
  const open = openNow(biz);
  const tel = `tel:${biz.phone}`;
  const route = routeUrl(biz.city, biz.address, biz.yandexMapsUrl);
  const services: WidgetService[] = biz.services.map((s) => ({
    id: s.id,
    category: s.category,
    name: s.name,
    description: s.description,
    priceFrom: s.priceFrom,
    durationMin: s.durationMin,
    isDiagnostic: s.isDiagnostic,
  }));
  const defaultServiceId = (services.find((s) => !s.isDiagnostic) ?? services[0])?.id ?? "";
  const headline = biz.headline || "Запись онлайн без очереди";
  const demo = biz.status === "demo";

  // В демо владелец может посмотреть сайт в другом стиле: ?theme=plan (оформление ставит layout). Сохраняется только по кнопке «Выбрать».
  const asked = (await searchParams).theme;
  const theme: ThemeKey = demo && isThemeKey(asked) ? asked : (biz.theme as ThemeKey);
  const pagePath = base || "/";

  const reviewsWord = reviews > 0 ? `${reviews} ${plural(reviews, "отзыв", "отзыва", "отзывов")} на картах` : null;
  const phone = formatPhone(biz.phone);
  const logoUrl = logoSrc(base, biz.logoAt);
  // eslint-disable-next-line @next/next/no-img-element -- логотип с нашего же адреса, размер задан стилем
  const brandLogo = logoUrl && <img className="brand-logo" src={logoUrl} alt={biz.name} />;

  // Подключённый сервис без реквизитов оператора: согласие клиента было бы недействительным, запись только по телефону
  const noOnline = operatorMissing(biz);
  const widget = noOnline ? (
    <p className="closed-note">
      Онлайн-запись временно недоступна. Позвоните в сервис: <a href={`tel:${biz.phone}`}>{phone}</a>
    </p>
  ) : (
    <BookingWidget
      services={services}
      apiBase={apiBase}
      siteBase={base}
      consentHref={`${base}/consent`}
      privacyHref={`${base}/privacy`}
      captchaKey={captchaClientKey()}
      timezone={biz.timezone}
      phone={biz.phone}
      phoneLabel={formatPhone(biz.phone)}
      demo={demo}
    />
  );

  const servicesBlock = (title: string) => (
    <section className="block svc-block" aria-labelledby="svc-h">
      <h2 className="h4" id="svc-h">{title}</h2>
      <p className="note-sm">Цены «от»: точную стоимость назовёт мастер. Нажмите на услугу, чтобы выбрать время</p>
      <ServicesList services={services} />
    </section>
  );

  const seasonBlock = season && (
    <div className="season">
      <span className="ic">{season.title.includes("зимней") ? <Snowflake /> : <Sun />}</span>
      <p>
        <b>{season.title}.</b> {season.text}
      </p>
    </div>
  );

  // Пустой блок «О сервисе» (в демо без фактов и пояснения к адресу) не показываем
  const aboutBlock = (facts.length > 0 || !!biz.addressNote) && (
    <section className="block" aria-labelledby="about-h">
      <h2 className="h4" id="about-h">О сервисе</h2>
      {biz.addressNote && <p className="note-sm">{biz.addressNote}</p>}
      <div className="about">
        {facts.length > 0 && (
          <div className="facts">
            {facts.map((f, i) => (
              <div className="fact" key={i}>
                <b>{f.value}</b>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const reviewsBlock = (rating || biz.yandexMapsUrl || biz.twoGisUrl) && (
    <section className="block" aria-labelledby="rev-h">
      <h2 className="h4" id="rev-h">Отзывы</h2>
      <div className="reviews">
        {rating && (
          <div className="score">
            <b>{rating}</b>
            <div className="stars" role="img" aria-label={`Рейтинг ${rating} из 5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span className="ic" key={i}>
                  <Star weight={i < Math.round(Number(biz.rating)) ? "fill" : "regular"} />
                </span>
              ))}
            </div>
            {reviews > 0 && <span>{reviews} {plural(reviews, "отзыв", "отзыва", "отзывов")}</span>}
          </div>
        )}
        <div className="src">
          {biz.yandexMapsUrl && (
            <a href={biz.yandexMapsUrl} target="_blank" rel="noopener noreferrer">
              Яндекс Карты {biz.reviewsYandex ? <span>{biz.reviewsYandex}</span> : null}
            </a>
          )}
          {biz.twoGisUrl && (
            <a href={biz.twoGisUrl} target="_blank" rel="noopener noreferrer">
              2ГИС {biz.reviews2gis ? <span>{biz.reviews2gis}</span> : null}
            </a>
          )}
        </div>
      </div>
    </section>
  );

  // В «Такси» на компьютере блок стоит ещё и справа под панелью времени, поэтому id с суффиксом
  const contacts = (suffix = "") => (
    <section className="block" aria-labelledby={`way-h${suffix}`} id={suffix ? undefined : "where"}>
      <h2 className="h4" id={`way-h${suffix}`}>Как добраться</h2>
      <dl className="contacts">
        <div>
          <dt>Адрес</dt>
          <dd>
            {biz.city}, {biz.address}
            {biz.addressNote ? `. ${biz.addressNote}` : ""}
          </dd>
        </div>
        <div>
          <dt>Часы</dt>
          <dd>
            {hoursLines(biz.hours).map((l) => (
              <span key={l} style={{ display: "block" }}>
                {l}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Телефон</dt>
          <dd>
            <a href={tel}>{phone}</a>
          </dd>
        </div>
      </dl>
      <div className="two">
        <a className="btn alt" href={route} target="_blank" rel="noopener noreferrer">
          <span className="ic">
            <NavigationArrow />
          </span>
          Маршрут
        </a>
        <a className="btn alt" href={tel}>
          <span className="ic">
            <Phone />
          </span>
          Позвонить
        </a>
      </div>
    </section>
  );
  const contactsBlock = contacts();

  const meta = (
    <div className="sub">
      {rating && (
        <span className="r">
          <span className="ic">
            <Star weight="fill" />
          </span>
          {rating}
        </span>
      )}
      {reviewsWord && <span>{reviewsWord}</span>}
      {open && <span className="open">{open}</span>}
    </div>
  );

  const callBtn = (
    <a className="call" href={tel} aria-label={`Позвонить ${phone}`}>
      <span className="ic">
        <Phone />
      </span>
      <span className="num">{phone}</span>
    </a>
  );

  let content: React.ReactNode;
  if (theme === "tire") {
    const bands = radiusBands(services);
    const radii = radiusList(bands);
    const ring = [biz.name.replace(/[«»"]/g, ""), biz.city].join(" • ").toUpperCase();
    content = (
      <>
        <header className="hero">
          <div className="top">
            {brandLogo}
            <div className="who">
              <b>{biz.name}</b>
              <span>
                {biz.city}, {biz.address}
              </span>
            </div>
            {callBtn}
          </div>
          <TireArt text={ring} />
          <div className="hero-text">
            <h1 className="h3">{headline}</h1>
            {meta}
          </div>
        </header>
        <div className="layout">
          {radii.length > 0 && <RadiusPicker services={services} bands={bands} radii={radii} />}
          {seasonBlock}
          <div className="book-col">{widget}</div>
          {servicesBlock(radii.length > 0 ? "Все услуги и цены" : "Услуги и цены")}
          {aboutBlock}
          {reviewsBlock}
          {contactsBlock}
        </div>
      </>
    );
  } else if (theme === "plan") {
    content = (
      <>
        <header className="top">
          {brandLogo}
          <div className="who">
            <b>{biz.name}</b>
            <span>
              {biz.city}, {biz.address}
            </span>
          </div>
          {callBtn}
        </header>
        <section className="hero">
          <h1 className="h3">{headline}</h1>
          <div className="side">
            {meta}
            {seasonBlock}
          </div>
        </section>
        {defaultServiceId && !noOnline && (
          <PostsPlan services={services} defaultServiceId={defaultServiceId} apiBase={apiBase} stepMin={biz.slotStepMin} phone={biz.phone} phoneLabel={phone} />
        )}
        <div className="layout">
          <div className="book-col">{widget}</div>
          {servicesBlock("Услуги и цены")}
          {aboutBlock}
          {reviewsBlock}
          {contactsBlock}
        </div>
      </>
    );
  } else {
    const logo = shortName(biz.name);
    content = (
      <>
        <header className="nav">
          {brandLogo}
          <span className={`logo${logo.length > 12 ? " long" : ""}`} title={logo}>{logo}</span>
          {callBtn}
        </header>
        <div className="hero">
          <h1 className="hello">{headline}</h1>
          <div className="aside">
            {defaultServiceId && !noOnline && <DayLoad services={services} defaultServiceId={defaultServiceId} apiBase={apiBase} phone={biz.phone} phoneLabel={phone} />}
            <div className="side-where">{contacts("-side")}</div>
          </div>
          <div className="sheet">
            <div className="grab" aria-hidden="true" />
            <p className="sheet-name">{biz.name}</p>
            <p className="where">
              {biz.address}
              {biz.addressNote ? `. ${biz.addressNote}` : ""}
            </p>
            {meta}
            {widget}
          </div>
        </div>
        <div className="below">
          {season && (
            <section className="promo">
              <div>
                <h2>{season.title}</h2>
                <p>{season.text}</p>
              </div>
            </section>
          )}
          <div className="card">{servicesBlock("Услуги и цены")}</div>
          {/* Правая колонка на компьютере: блоки идут друг за другом, без дыр рядом с длинным списком услуг */}
          <div className="side-col">
            {aboutBlock && <div className="card">{aboutBlock}</div>}
            {reviewsBlock && <div className="card">{reviewsBlock}</div>}
            <div className="card where-card">{contactsBlock}</div>
          </div>
        </div>
      </>
    );
  }

  const footer = (
    <footer className="foot">
      {biz.operatorName ? (
        <>
          {biz.operatorName}
          {biz.operatorInn ? `, ИНН ${biz.operatorInn}` : ""}, оператор персональных данных.
          <br />
        </>
      ) : null}
      <a href={`${base}/privacy`}>Политика обработки персональных данных</a>
      <br />
      <a href={`${base}/consent`}>Согласие на обработку персональных данных</a>
      <br />
      {/* Ссылка на главную Автослота: соседние сервисы, увидев сайт, могут подключиться сами. Новая вкладка — запись не теряется */}
      Сайт работает на сервисе{" "}
      <a href={process.env.ROOT_DOMAIN ? `https://${process.env.ROOT_DOMAIN}` : process.env.APP_URL || "https://avtoslot.ru"} target="_blank" rel="noopener">
        «Автослот»
      </a>
    </footer>
  );

  return (
    <>
      {demo ? (
        <ThemeSwitch shown={theme} saved={biz.theme as ThemeKey} chosen={!!biz.themeChosenAt} apiBase={apiBase} pagePath={pagePath} example={isExampleSlug(biz.slug)} />
      ) : null}
      {content}
      {footer}
    </>
  );
}
