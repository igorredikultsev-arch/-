import type { Metadata } from "next";
import { Camera, NavigationArrow, Phone, Snowflake, Star, Sun } from "@phosphor-icons/react/dist/ssr";
import { getSiteBusiness, readFacts } from "@/lib/business";
import { captchaClientKey } from "@/lib/captcha";
import { formatPhone } from "@/lib/phone";
import { seasonNotice } from "@/lib/season";
import { routeUrl, siteBase } from "@/lib/site-url";
import { hhmm, toLocal, weekdayOf } from "@/lib/time";
import { BookingWidget, type WidgetService } from "./booking-widget";
import { ServicesList } from "./services-list";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const biz = await getSiteBusiness(decodeURIComponent((await params).slug));
  if (!biz) return {};
  return {
    title: `${biz.name}: онлайн-запись`,
    description: `${biz.name}, ${biz.city}, ${biz.address}. Запись на свободное время без звонка.`,
    // Демо не индексируется (раздел 6.7 плана)
    robots: biz.status === "demo" ? { index: false, follow: false } : undefined,
  };
}

const WD = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** «Пн-Пт 9:00-20:00», «Сб 10:00-16:00», «Вс выходной» — подряд идущие одинаковые дни склеиваются. */
function hoursLines(hours: { weekday: number; closed: boolean; openMin: number; closeMin: number }[]) {
  const byDay = (d: number) => {
    const h = hours.find((x) => x.weekday === d);
    return !h || h.closed ? "выходной" : `${hhmm(h.openMin).replace(/^0/, "")}-${hhmm(h.closeMin).replace(/^0/, "")}`;
  };
  const lines: string[] = [];
  let start = 1;
  for (let d = 2; d <= 8; d++) {
    if (d === 8 || byDay(d) !== byDay(start)) {
      const days = d - 1 === start ? WD[start] : `${WD[start]}-${WD[d - 1]}`;
      lines.push(`${days} ${byDay(start)}`);
      start = d;
    }
  }
  return lines;
}

function openNow(biz: { timezone: string; hours: { weekday: number; closed: boolean; openMin: number; closeMin: number }[] }) {
  const now = toLocal(Date.now(), biz.timezone);
  const h = biz.hours.find((x) => x.weekday === weekdayOf(now.date));
  if (!h || h.closed) return null;
  if (now.minutes >= h.openMin && now.minutes < h.closeMin) return `Открыто до ${hhmm(h.closeMin)}`;
  return null;
}

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

export default async function SitePage({ params }: Props) {
  const key = decodeURIComponent((await params).slug);
  const biz = (await getSiteBusiness(key))!;
  const base = await siteBase(key);
  const apiBase = `/api/s/${encodeURIComponent(key)}`;
  const season = seasonNotice(Date.now(), biz.timezone);
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
  const letter = (biz.logoLetter || biz.name.replace(/[«»"]/g, "").split(/\s+/).pop()?.[0] || "А").toUpperCase();

  return (
    <>
      {biz.status === "demo" && <div className="demo">Демо-версия. Не официальный сайт</div>}

      <section className="hero">
        <div className="brand">
          <div className="mark" aria-hidden="true">{letter}</div>
          <div>
            <b>{biz.name}</b>
            <span>
              {biz.city}, {biz.address}
            </span>
          </div>
        </div>
        {biz.theme === "book" && (
          <div className="stamp" aria-hidden="true">
            Запись
            <br />
            онлайн
            <br />
            без звонка
          </div>
        )}
        <h1 className="h3">{biz.headline || "Запись онлайн без очереди"}</h1>
        <div className="sub">
          {rating && (
            <span className="r">
              <span className="ic">
                <Star weight="fill" />
              </span>
              {rating}
            </span>
          )}
          {reviews > 0 && (
            <span>
              {reviews} {plural(reviews, "отзыв", "отзыва", "отзывов")} на картах
            </span>
          )}
          {open && <span className="open">{open}</span>}
        </div>
        <div className="cta">
          <a className="btn" href="#book">
            Записаться
          </a>
          <a className="btn alt" href={tel} aria-label={`Позвонить ${formatPhone(biz.phone)}`}>
            <span className="ic">
              <Phone />
            </span>
          </a>
        </div>
      </section>

      {season && (
        <div className="season">
          <span className="ic">{season.title.includes("зимней") ? <Snowflake /> : <Sun />}</span>
          <div>
            <b>{season.title}</b>
            <p>{season.text}</p>
          </div>
        </div>
      )}

      <section className="block">
        <h2 className="h4">Услуги и цены</h2>
        <p className="note-sm">Цены «от»: точную стоимость назовёт мастер</p>
        <ServicesList services={services} />
      </section>

      <BookingWidget
        services={services}
        apiBase={apiBase}
        siteBase={base}
        consentHref={`${base}/consent`}
        privacyHref={`${base}/privacy`}
        captchaKey={captchaClientKey()}
        timezone={biz.timezone}
      />

      {(facts.length > 0 || biz.status === "demo") && (
        <section className="block">
          <h2 className="h4">О сервисе</h2>
          <div className="photos">
            {biz.status === "demo" ? (
              <div className="photo big">
                <span className="ic">
                  <Camera />
                </span>
                Фото мастерской
                <br />
                владелец добавит после подключения
              </div>
            ) : null}
            {facts.length > 0 && (
              <div className="facts" style={biz.status === "demo" ? undefined : { gridColumn: "1 / -1" }}>
                {facts.map((f) => (
                  <div className="fact" key={f.value}>
                    <b>{f.value}</b>
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {(rating || biz.yandexMapsUrl || biz.twoGisUrl) && (
        <section className="block">
          <h2 className="h4">Отзывы</h2>
          <div className="reviews">
            {rating && (
              <div className="score">
                <b>{rating}</b>
                <div className="stars" aria-label={`Рейтинг ${rating} из 5`}>
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
      )}

      <section className="block">
        <h2 className="h4">Как добраться</h2>
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
              <a href={tel}>{formatPhone(biz.phone)}</a>
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
          <a className="btn" href={tel}>
            <span className="ic">
              <Phone />
            </span>
            Позвонить
          </a>
        </div>
      </section>

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
        Сайт работает на сервисе «Автослот»
      </footer>
    </>
  );
}
