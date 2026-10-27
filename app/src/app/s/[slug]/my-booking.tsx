"use client";

// Запись клиента на этом устройстве: страница записи её запоминает, а сайт сервиса показывает сверху
// «Вы записаны…» — чтобы открыть и отменить запись, даже если вкладку закрыли. Другой телефон её не знает.
import { useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";

type Saved = { site: string; href: string; when: string; what: string; end: number };
const KEY = "avtoslot-bookings";

function read(): Saved[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((b) => b && b.end > Date.now()) : [];
  } catch {
    return [];
  }
}

/** На странице записи: активную запомнить, отменённую или прошедшую — забыть. */
export function RememberBooking({ active, site, href, when, what, end }: Saved & { active: boolean }) {
  useEffect(() => {
    const list = read().filter((x) => x.href !== href);
    try {
      localStorage.setItem(KEY, JSON.stringify(active ? [...list, { site, href, when, what, end }] : list));
    } catch {}
  }, [active, site, href, when, what, end]);
  return null;
}

/** На сайте сервиса: плашка на каждую будущую запись с этого устройства. */
export function MyBookings({ site }: { site: string }) {
  const [list, setList] = useState<Saved[]>([]);
  useEffect(() => setList(read().filter((b) => b.site === site).sort((a, b) => a.end - b.end)), [site]);
  return list.map((b) => (
    <a className="my-bk" href={b.href} key={b.href}>
      <span className="t">
        <b>Вы записаны: {b.when}</b>
        <small>{b.what}. Посмотреть или отменить</small>
      </span>
      <CaretRight size={18} aria-hidden />
    </a>
  ));
}
