"use client";

import { useEffect, useState } from "react";
import type { LaneSpan } from "@/lib/slots";
import { STATE_EVENT, type BookState } from "./events";

export type Day = { date: string; closed: boolean; free: number; ended?: true };
export type SlotRow = { time: string; free: boolean };
export type Load = { date: string; open: number; close: number; now: number | null; busy: LaneSpan[]; lunch?: LaneSpan | null } | null;

/**
 * Данные дня для витрины («План», «Такси»): дни горизонта, когда сервис занят и окна выбранной услуги.
 * Услуга по умолчанию — первая обычная; когда клиент выбирает услугу в форме, витрина переключается на неё.
 */
export function useDay(apiBase: string, defaultServiceId: string) {
  const [serviceId, setServiceId] = useState(defaultServiceId);
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [load, setLoad] = useState<Load | undefined>(undefined); // undefined — ещё грузится
  const [slots, setSlots] = useState<SlotRow[] | null>(null);
  const [picked, setPicked] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const s = (e as CustomEvent<BookState>).detail;
      if (s.serviceId) setServiceId(s.serviceId);
      setPicked(s.date && s.time ? { date: s.date, time: s.time } : null);
      if (s.date && s.time) setDate(s.date);
    };
    window.addEventListener(STATE_EVENT, on);
    return () => window.removeEventListener(STATE_EVENT, on);
  }, []);

  useEffect(() => {
    let off = false;
    fetch(`${apiBase}/days?service=${serviceId}`)
      .then((r) => (r.ok ? r.json() : { days: [] }))
      .then((d: { days: Day[] }) => {
        if (off) return;
        setDays(d.days);
        const next = (cur: string | null) => (cur && d.days.some((x) => x.date === cur && !x.closed) ? cur : (d.days.find((x) => x.free > 0) ?? d.days.find((x) => !x.closed))?.date ?? null);
        setDate((cur) => {
          const v = next(cur);
          // Все дни выходные: грузить нечего, витрина показывает пустое состояние, а не вечную загрузку
          if (!v) { setLoad(null); setSlots([]); }
          return v;
        });
      })
      .catch(() => !off && setDays([]));
    return () => { off = true; };
  }, [apiBase, serviceId]);

  useEffect(() => {
    if (!date) return;
    let off = false;
    setLoad(undefined);
    setSlots(null);
    Promise.all([
      fetch(`${apiBase}/load?date=${date}`).then((r) => (r.ok ? r.json() : { load: null })),
      fetch(`${apiBase}/slots?service=${serviceId}&date=${date}`).then((r) => (r.ok ? r.json() : { slots: [] })),
    ])
      .then(([l, s]) => {
        if (off) return;
        setLoad(l.load);
        setSlots(s.slots);
      })
      .catch(() => { if (!off) { setLoad(null); setSlots([]); } });
    return () => { off = true; };
  }, [apiBase, serviceId, date]);

  // Во всём горизонте нет ни одного свободного окна (всё занято или выходные)
  const noneAtAll = days !== null && days.length > 0 && days.every((x) => x.free === 0);
  return { serviceId, setServiceId, days, date, setDate, load, slots, picked, noneAtAll };
}

export const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
export const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
export const busyAt = (lane: LaneSpan[], from: number, to: number) => lane.some((s) => s.from < to && from < s.to);

/** Ширина экрана: на компьютере шкала дня целиком, на телефоне от текущего часа. */
export function useWide(query = "(min-width: 960px)") {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = matchMedia(query);
    setWide(m.matches);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return wide;
}
