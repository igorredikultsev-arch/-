"use client";

// Календарь кабинета как Google Календарь: сетка дня, 3 дней и недели, месяц, мини-календарь и «Мои календари»
// слева, быстрая запись прямо в сетке, окно записи по нажатию, перетаскивание и растягивание записей.
// Посты — это «календари»: у каждого свой цвет, галочка скрывает его записи.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarBlank, CaretDown, CaretLeft, CaretRight, Check, Clock, DotsThreeVertical, DownloadSimple, Gear, Globe, List, PencilSimple, Phone, Plus, Trash, User, X,
} from "@phosphor-icons/react";
import { googleLayout, textOn } from "@/lib/calendar";
import { addDays, hhmm, weekdayOf } from "@/lib/time";
import { calendarCreate, calendarMove, noteUpdate, setBookingStaff, setBookingStatus } from "../actions";

export type CalView = "day" | "3days" | "week" | "month" | "custom";
/** Сколько дней можно выделить в мини-календаре: больше — столбцы слишком узкие */
export const MAX_RANGE_DAYS = 14;
export type CalBooking = {
  id: string; start: number; end: number; title: string; status: "active" | "done" | "no_show" | "cancelled"; site: boolean;
  staffId: string; ownStaff: boolean; phone: string | null; phoneText: string | null; author: string;
};
export type CalNote = { id: string; title: string; startDate: string; endDate: string; staffId: string | null };
type Staff = { id: string; name: string; color: string };

type Props = {
  view: CalView; days: number; date: string; today: string; nowMs: number; gmt: string; dates: string[]; monthStart: string; monthEnd: string;
  dayStarts: Record<string, number>; scrollMin: number; scrollEndMin: number; hidden: string[]; staff: Staff[]; bookings: CalBooking[]; notes: CalNote[];
  explicitView: boolean;
  /** Вход мастера: только смотреть — ни записи, ни переноса, ни удаления */
  readOnly?: boolean;
};

const HOUR = 48; // высота часа, как в Google, — самая крупная
/** Мельче часа не делаем: короткие записи перестают читаться */
const MIN_HOUR = 22;
const SNAP = 15;
const BLUE = "#0b57d0";
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_SHORT = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."];
const WD = ["", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const WD_MINI = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WD_FULL = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const VIEW_NAMES: { v: CalView; label: string; key: string }[] = [
  { v: "day", label: "День", key: "D" }, { v: "3days", label: "3 дня", key: "X" }, { v: "week", label: "Неделя", key: "W" }, { v: "month", label: "Месяц", key: "M" },
];
const TIMES = Array.from({ length: 96 }, (_, i) => i * 15);

const dayNum = (d: string) => Number(d.slice(8, 10));
const daysBetween = (a: string, z: string) => Math.round((Date.parse(`${z}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const daysLabel = (n: number) => `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "дня" : "дней"}`;
const monthIdx = (d: string) => Number(d.slice(5, 7)) - 1;
const longDate = (d: string) => `${WD_FULL[weekdayOf(d)]}, ${dayNum(d)} ${MONTHS_GEN[monthIdx(d)]}`;
const nextMonth = (d: string) => { const [y, m] = d.split("-").map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; };
const prevMonth = (d: string) => `${addDays(`${d.slice(0, 8)}01`, -1).slice(0, 8)}01`;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** Прошедшие записи бледнее, как в Google («Уменьшить яркость прошедших мероприятий»). */
const pastBg = (c: string) => `color-mix(in srgb, ${c} 34%, white)`;
/** Будущие чуть приглушены: на сетке с десятком записей полные цвета Google режут глаз. */
const calmBg = (c: string) => `color-mix(in srgb, ${c} 86%, white)`;
/** Шрифт как в Google Календаре: тоньше и спокойнее шрифта кабинета. */
const GOOGLE_FONT = 'Roboto, "Google Sans", "Segoe UI", Arial, sans-serif';

type Preview = { id: string | null; date: string; start: number; dur: number };
type Create = { date: string; start: number; dur: number; allDay: boolean; staffId: string; title: string; anchor: Anchor | null };
type Anchor = { left: number; right: number; top: number; bottom: number };
type Pop = { kind: "event"; id: string; anchor: Anchor } | { kind: "note"; id: string; anchor: Anchor } | null;
type Drag = {
  id: string | null; mode: "move" | "resize" | "create"; pointerId: number; touch: boolean; x0: number; y0: number; active: boolean;
  date0: string; min0: number; start0: number; dur0: number; grab: number; el: HTMLElement | null; timer: number | null; last: Preview | null;
};

export function Calendar(p: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [hidden, setHidden] = useState(() => new Set(p.hidden));
  const [now, setNow] = useState(p.nowMs);
  const [sidebar, setSidebar] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [viewMenu, setViewMenu] = useState(false);
  const [mini, setMini] = useState(`${p.date.slice(0, 8)}01`);
  const [calsOpen, setCalsOpen] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [create, setCreate] = useState<Create | null>(null);
  const [pop, setPop] = useState<Pop>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  // До ответа сервера: перенесённые, удалённые и только что созданные записи показываем сразу
  const [moved, setMoved] = useState<Map<string, { start: number; end: number }>>(new Map());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [temp, setTemp] = useState<CalBooking[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const cols = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<Drag | null>(null);
  // Высота часа: рабочий день целиком на экране без прокрутки, как у клиента в Google (просьба «Конкурента»)
  const [hour, setHour] = useState(HOUR);

  useEffect(() => { setMoved(new Map()); setRemoved(new Set()); setTemp([]); }, [p.bookings, p.notes]);
  useEffect(() => { setMini(`${p.date.slice(0, 8)}01`); }, [p.date]);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    try { if (localStorage.getItem("cal-sidebar") === "0") setSidebar(false); } catch {}
    // На телефоне по умолчанию «3 дня», как в приложении Google
    if (!p.explicitView && window.innerWidth < 640) router.replace(href("3days", p.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  const href = (v: CalView, d: string, h: Set<string> = hidden, n = p.days) => `/cabinet/week?view=${v}&date=${d}${v === "custom" ? `&days=${n}` : ""}${h.size ? `&hide=${[...h].join(",")}` : ""}`;
  const go = (v: CalView, d: string) => router.push(href(v, d));
  const shift = (n: number) => (p.view === "month" ? (n > 0 ? nextMonth(p.date) : prevMonth(p.date)) : addDays(p.date, n * (p.view === "week" ? 7 : p.view === "3days" ? 3 : p.view === "custom" ? p.days : 1)));
  const toggleCal = (id: string) => {
    const h = new Set(hidden);
    if (h.has(id)) h.delete(id); else h.add(id);
    setHidden(h);
    window.history.replaceState(null, "", href(p.view, p.date, h));
  };
  const staffById = useMemo(() => new Map(p.staff.map((s) => [s.id, s])), [p.staff]);
  const color = (staffId: string | null) => (staffId && staffById.get(staffId)?.color) || "#039be5";

  const bookings = useMemo(
    () => [...p.bookings, ...temp]
      .filter((b) => !removed.has(b.id) && !hidden.has(b.staffId))
      .map((b) => (moved.has(b.id) ? { ...b, ...moved.get(b.id)! } : b)),
    [p.bookings, temp, removed, hidden, moved],
  );
  const notes = p.notes.filter((n) => !removed.has(n.id) && !(n.staffId && hidden.has(n.staffId)));

  // Заголовок как в Google: «Октябрь 2026», «Окт. – нояб. 2026», в «Дне» — «22 октября 2026 г.»
  const a = p.dates[0], z = p.dates[p.dates.length - 1];
  const title = p.view === "month" ? `${MONTHS[monthIdx(p.date)]} ${p.date.slice(0, 4)}`
    : p.view === "day" ? `${dayNum(p.date)} ${MONTHS_GEN[monthIdx(p.date)]} ${p.date.slice(0, 4)} г.`
    : monthIdx(a) === monthIdx(z) ? `${MONTHS[monthIdx(a)]} ${z.slice(0, 4)}`
    : `${MONTHS_SHORT[monthIdx(a)].replace(/^./, (c) => c.toUpperCase())} – ${MONTHS_SHORT[monthIdx(z)]} ${z.slice(0, 4)}`;
  const shown = p.view === "month" ? [p.monthStart, p.monthEnd] : [a, z];
  const showsToday = p.today >= shown[0] && p.today <= shown[1];

  const openEvent = (id: string, el: HTMLElement) => {
    if (id.startsWith("tmp-")) return;
    const r = el.getBoundingClientRect();
    setCreate(null);
    setPop({ kind: "event", id, anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } });
  };

  /* ---------- быстрая запись ---------- */

  const openCreate = (date: string, start: number, dur: number, allDay: boolean, anchor: Anchor | null) => {
    if (p.readOnly) return;
    setPop(null);
    setCreate({ date, start, dur, allDay, staffId: "", title: "", anchor });
  };
  const createNow = () => {
    const nowMin = Math.floor(((now - (p.dayStarts[p.today] ?? now)) / 60000) / 30) * 30 + 30;
    const date = p.dayStarts[p.today] != null ? p.today : p.dates[0];
    openCreate(date, clamp(nowMin, 0, 1380), 60, false, null);
  };
  const saveCreate = (c: Create) => {
    const t = c.title.trim();
    if (!t) return "Напишите, кого записываем";
    const tmp: CalBooking = {
      id: `tmp-${Date.now()}`, start: (p.dayStarts[c.date] ?? 0) + c.start * 60000, end: (p.dayStarts[c.date] ?? 0) + (c.start + c.dur) * 60000,
      title: t, status: "active", site: false, staffId: c.staffId || p.staff[0]?.id || "", ownStaff: !!c.staffId, phone: null, phoneText: null, author: "",
    };
    if (!c.allDay && p.dayStarts[c.date] != null) setTemp((x) => [...x, tmp]);
    setCreate(null);
    startTransition(async () => {
      const r = await calendarCreate({ title: t, date: c.date, startMin: c.start, durationMin: c.dur, staffId: c.staffId || null, allDay: c.allDay }).catch(() => ({ error: "Не получилось сохранить. Проверьте интернет", id: undefined }));
      if (r.error) { setTemp((x) => x.filter((b) => b.id !== tmp.id)); setToast({ text: r.error }); }
      else setToast({ text: c.allDay ? "Запись на весь день сохранена" : "Запись сохранена" });
      router.refresh();
    });
    return null;
  };

  /* ---------- перетаскивание ---------- */

  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const fit = () => {
      const h = Math.round(sc.clientHeight / Math.max(1, (p.scrollEndMin - p.scrollMin) / 60));
      const next = Math.min(HOUR, Math.max(MIN_HOUR, h));
      setHour(next);
      sc.scrollTop = (p.scrollMin / 60) * next - 4;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [p.scrollMin, p.scrollEndMin, p.view]);

  // На телефоне дни листаются пальцем влево и вправо, как в приложении Google
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    let x0 = 0, y0 = 0, t0 = 0;
    const start = (e: TouchEvent) => { if (e.touches.length !== 1) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); };
    const end = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - x0, dy = t.clientY - y0;
      if (drag.current?.active || Date.now() - t0 > 700) return;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(p.view, shift(dx < 0 ? 1 : -1));
    };
    sc.addEventListener("touchstart", start, { passive: true });
    sc.addEventListener("touchend", end);
    return () => { sc.removeEventListener("touchstart", start); sc.removeEventListener("touchend", end); };
  });

  const slotAt = (x: number, y: number): { date: string; min: number } | null => {
    // Колонка под пальцем; левее или правее сетки — ближайшая
    let best: { date: string; rect: DOMRect; dist: number } | null = null;
    for (const [date, el] of cols.current) {
      const r = el.getBoundingClientRect();
      const dist = x < r.left ? r.left - x : x >= r.right ? x - r.right + 1 : 0;
      if (!best || dist < best.dist) best = { date, rect: r, dist };
    }
    if (!best) return null;
    return { date: best.date, min: clamp(((y - best.rect.top) / hour) * 60, 0, 1440) };
  };

  const beginDrag = (e: React.PointerEvent, b: CalBooking | null, mode: Drag["mode"]) => {
    // Мастеру записи не перетаскиваются; открываются обычным нажатием (onClick в колонке)
    if (e.button !== 0 || create || p.readOnly) return;
    const s = slotAt(e.clientX, e.clientY);
    if (!s) return;
    e.stopPropagation();
    const touch = e.pointerType === "touch";
    const start0 = b ? Math.round((b.start - p.dayStarts[s.date]) / 60000) : s.min;
    const dur0 = b ? Math.round((b.end - b.start) / 60000) : 60;
    const d: Drag = {
      id: b?.id ?? null, mode, pointerId: e.pointerId, touch, x0: e.clientX, y0: e.clientY, active: false, date0: s.date, min0: s.min,
      start0, dur0, grab: s.min - start0, el: e.currentTarget as HTMLElement, timer: null, last: null,
    };
    // Палец: запись берётся долгим нажатием, иначе это прокрутка
    if (touch && b && !b.id.startsWith("tmp-")) {
      d.timer = window.setTimeout(() => {
        d.active = true;
        d.last = { id: d.id, date: d.date0, start: d.start0, dur: d.dur0 };
        setPreview(d.last);
        navigator.vibrate?.(20);
      }, 420);
    }
    drag.current = d;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dist = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
      if (!d.active) {
        if (d.touch) { if (dist > 8) { if (d.timer) clearTimeout(d.timer); drag.current = null; } return; }
        if (dist < 4 || (d.id?.startsWith("tmp-") ?? false)) return;
        d.active = true;
        document.body.style.userSelect = "none";
      }
      const s = slotAt(e.clientX, e.clientY);
      if (!s) return;
      let next: Preview;
      if (d.mode === "move") next = { id: d.id, date: s.date, start: clamp(snap(s.min - d.grab), 0, 1440 - SNAP), dur: d.dur0 };
      else if (d.mode === "resize") next = { id: d.id, date: d.date0, start: d.start0, dur: clamp(snap(s.min) - d.start0, SNAP, 1440 - d.start0) };
      else {
        const lo = Math.floor(Math.min(d.min0, s.min) / SNAP) * SNAP, hi = Math.ceil(Math.max(d.min0, s.min) / SNAP) * SNAP;
        next = { id: null, date: d.date0, start: lo, dur: Math.max(SNAP, hi - lo) };
      }
      d.last = next;
      setPreview(next);
      // У края сетки она прокручивается сама
      const sc = scroller.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (e.clientY < r.top + 24) sc.scrollTop -= 12;
        else if (e.clientY > r.bottom - 24) sc.scrollTop += 12;
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
      if (d.timer) clearTimeout(d.timer);
      document.body.style.userSelect = "";
      if (e.type === "pointercancel") { setPreview(null); return; }
      const col = cols.current.get(d.date0)?.getBoundingClientRect();
      if (!d.active) {
        // Нажатие без движения: на записи — окно записи, на пустом месте — быстрая запись на получас вниз
        if (d.mode === "create") {
          const start = clamp(Math.floor(d.min0 / 30) * 30, 0, 1380);
          openCreate(d.date0, start, 60, false, col ? { left: col.left, right: col.right, top: col.top + (start / 60) * hour, bottom: col.top + ((start + 60) / 60) * hour } : null);
        } else if (d.id && d.el) openEvent(d.id, d.el);
        setPreview(null);
        return;
      }
      const last = d.last;
      setPreview(null);
      if (!last) return;
      if (d.mode === "create") {
        const c = cols.current.get(last.date)?.getBoundingClientRect();
        openCreate(last.date, last.start, last.dur, false, c ? { left: c.left, right: c.right, top: c.top + (last.start / 60) * hour, bottom: c.top + ((last.start + last.dur) / 60) * hour } : null);
        return;
      }
      if (!d.id || (last.date === d.date0 && last.start === d.start0 && last.dur === d.dur0)) return;
      const id = d.id;
      const start = p.dayStarts[last.date] + last.start * 60000;
      setMoved((m) => new Map(m).set(id, { start, end: start + last.dur * 60000 }));
      startTransition(async () => {
        const r = await calendarMove(id, last.date, last.start, last.dur).catch(() => ({ error: "Не получилось перенести. Проверьте интернет" }));
        if (r.error) {
          setMoved((m) => { const n = new Map(m); n.delete(id); return n; });
          setToast({ text: r.error });
        }
        router.refresh();
      });
    };
    // Пока запись тащат пальцем, страница не прокручивается
    const touchmove = (e: TouchEvent) => { if (drag.current?.active) e.preventDefault(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    const sc = scroller.current;
    sc?.addEventListener("touchmove", touchmove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      sc?.removeEventListener("touchmove", touchmove);
    };
  });

  /* ---------- клавиши, как в Google ---------- */

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCreate(null); setPop(null); setViewMenu(false); setDrawer(false); return; }
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      const k = e.key.toLowerCase();
      const views: Record<string, CalView> = { d: "day", "в": "day", x: "3days", "ч": "3days", w: "week", "ц": "week", m: "month", "ь": "month" };
      if (views[k]) go(views[k], p.date);
      else if (k === "t" || k === "е") go(p.view, p.today);
      else if (k === "j" || k === "n" || k === "о" || k === "т") go(p.view, shift(1));
      else if (k === "k" || k === "p" || k === "л" || k === "з") go(p.view, shift(-1));
      else if ((k === "c" || k === "с") && !p.readOnly) { e.preventDefault(); createNow(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  /* ---------- части экрана ---------- */

  const calendars = (
    <div className="mt-4">
      <button type="button" onClick={() => setCalsOpen((v) => !v)} aria-expanded={calsOpen}
        className="flex h-10 w-full items-center justify-between rounded-full px-3 text-[15px] font-medium text-[#1f1f1f] hover:bg-[#e9eef6]">
        Мои календари <CaretDown size={16} className={calsOpen ? "rotate-180" : ""} />
      </button>
      {calsOpen && (
        <ul className="mt-1">
          {p.staff.map((s) => {
            const on = !hidden.has(s.id);
            return (
              <li key={s.id}>
                <label className="flex h-9 cursor-pointer items-center gap-3 rounded-full px-3 text-[14px] text-[#1f1f1f] hover:bg-[#e9eef6]">
                  <input type="checkbox" checked={on} onChange={() => toggleCal(s.id)} className="peer sr-only" />
                  <span className="grid size-[18px] shrink-0 place-items-center rounded-[3px] border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-[#0b57d0]"
                    style={{ borderColor: s.color, background: on ? s.color : "transparent", color: textOn(s.color) }}>
                    {on && <Check size={12} weight="bold" />}
                  </span>
                  <span className="truncate">{s.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 grid gap-0.5 border-t border-[#dde3ea] pt-3">
        {!p.readOnly && (
          <>
        <Link href="/cabinet/week/staff" className="flex h-9 items-center gap-3 rounded-full px-3 text-[14px] text-[#444746] hover:bg-[#e9eef6]"><Gear size={18} /> Посты и цвета</Link>
        <Link href="/cabinet/week/staff#import" className="flex h-9 items-center gap-3 rounded-full px-3 text-[14px] text-[#444746] hover:bg-[#e9eef6]"><DownloadSimple size={18} /> Перенести из Google</Link>
          </>
        )}
      </div>
    </div>
  );

  const miniMonth = <MiniMonth month={mini} setMonth={setMini} today={p.today} from={shown[0]} to={shown[1]} onPick={(d) => { setDrawer(false); go(p.view, d); }}
    onRange={(a, z) => { setDrawer(false); router.push(href("custom", a, hidden, Math.min(MAX_RANGE_DAYS, daysBetween(a, z) + 1))); }} />;

  return (
    <div className="flex h-[calc(100dvh-84px-env(safe-area-inset-bottom,0px))] flex-col bg-[#f8fafd] text-[#1f1f1f] lg:h-dvh" style={{ fontFamily: GOOGLE_FONT }}>
      {/* Верхняя строка: меню, «Сегодня», стрелки, месяц, вид */}
      <header className="flex h-16 shrink-0 items-center gap-1 px-2 sm:gap-2 sm:px-3">
        <button type="button" aria-label="Главное меню" onClick={() => {
          if (window.innerWidth >= 1024) { const v = !sidebar; setSidebar(v); try { localStorage.setItem("cal-sidebar", v ? "1" : "0"); } catch {} } else setDrawer(true);
        }} className="grid size-12 place-items-center rounded-full text-[#444746] hover:bg-[#e9eef6]">
          <List size={22} />
        </button>
        <span className="mr-6 hidden items-center gap-2 text-[22px] text-[#444746] xl:flex"><CalendarBlank size={30} weight="duotone" color={BLUE} /> Календарь</span>
        <Link href={href(p.view, p.today)} aria-current={showsToday ? "date" : undefined}
          className={`hidden h-10 items-center rounded-full border px-6 text-[14px] font-medium sm:flex ${showsToday ? "border-[#d3e3fd] bg-[#d3e3fd] text-[#041e49]" : "border-[#747775] text-[#1f1f1f] hover:bg-[#f1f3f4]"}`}>
          Сегодня
        </Link>
        <Link href={href(p.view, shift(-1))} aria-label="Назад" className="hidden size-10 place-items-center rounded-full text-[#444746] hover:bg-[#e9eef6] sm:grid"><CaretLeft size={18} /></Link>
        <Link href={href(p.view, shift(1))} aria-label="Вперёд" className="hidden size-10 place-items-center rounded-full text-[#444746] hover:bg-[#e9eef6] sm:grid"><CaretRight size={18} /></Link>
        <h1 className="ml-1 min-w-0 truncate text-[20px] font-normal text-[#1f1f1f] sm:text-[22px]">{title}</h1>
        <div className="ml-auto flex items-center gap-1">
          <Link href={href(p.view, p.today)} aria-label="Сегодня" className="relative grid size-10 place-items-center rounded-full text-[#444746] hover:bg-[#e9eef6] sm:hidden">
            <CalendarBlank size={24} /><span className="absolute top-[15px] text-[9px] font-bold">{dayNum(p.today)}</span>
          </Link>
          <div className="relative hidden sm:block">
            <button type="button" onClick={() => setViewMenu((v) => !v)} aria-expanded={viewMenu}
              className="flex h-10 items-center gap-2 rounded-full border border-[#747775] px-4 text-[14px] font-medium hover:bg-[#f1f3f4]">
              {VIEW_NAMES.find((v) => v.v === p.view)?.label ?? daysLabel(p.days)} <CaretDown size={14} />
            </button>
            {viewMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setViewMenu(false)} />
                <ul className="absolute right-0 top-11 z-50 w-48 rounded-lg bg-white py-2 shadow-[0_2px_6px_2px_rgba(60,64,67,.15),0_1px_2px_rgba(60,64,67,.3)]">
                  {VIEW_NAMES.map((v) => (
                    <li key={v.v}>
                      <Link href={href(v.v, p.date)} onClick={() => setViewMenu(false)}
                        className={`flex h-10 items-center justify-between px-4 text-[14px] hover:bg-[#f1f3f4] ${p.view === v.v ? "bg-[#e8f0fe]" : ""}`}>
                        {v.label} <span className="text-[12px] text-[#70757a]">{v.key}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebar && (
          <aside className="hidden w-64 shrink-0 overflow-y-auto px-3 pb-6 lg:block">
            {!p.readOnly && <button type="button" onClick={createNow}
              className="mb-5 flex h-14 items-center gap-3 rounded-2xl bg-white pl-4 pr-6 text-[14px] font-medium text-[#1f1f1f] shadow-[0_1px_3px_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)] hover:bg-[#f8fafd]">
              <Plus size={26} color={BLUE} weight="bold" /> Создать
            </button>}
            {miniMonth}
            {calendars}
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white sm:mr-3 sm:mb-3 sm:rounded-2xl lg:mr-4 lg:mb-4">
          {p.view === "month" ? (
            <MonthGrid p={p} bookings={bookings} notes={notes} color={color} now={now}
              onDay={(d) => go("day", d)}
              onEvent={openEvent}
              onNote={(id, el) => { const r = el.getBoundingClientRect(); setCreate(null); setPop({ kind: "note", id, anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }); }}
              onCreate={(d, el) => { const r = el.getBoundingClientRect(); openCreate(d, 540, 60, true, { left: r.left, right: r.right, top: r.top, bottom: r.bottom }); }} />
          ) : (
            <>
              {/* Дни: «ЧТ» и число, сегодня — в синем круге */}
              <div className="flex shrink-0 overflow-y-hidden border-b border-[#dde3ea] [scrollbar-gutter:stable]">
                <div className="w-14 shrink-0" />
                {p.dates.map((d) => {
                  const isToday = d === p.today;
                  return (
                    <div key={d} className={`flex min-w-0 flex-1 flex-col pb-1 pt-2 ${p.view === "day" ? "items-start pl-2" : "items-center"} border-l border-transparent`}>
                      <span className="text-[11px] font-medium tracking-wide" style={{ color: isToday ? BLUE : "#444746" }}>{WD[weekdayOf(d)]}</span>
                      <Link href={href("day", d)} aria-label={longDate(d)}
                        className={`mt-0.5 grid size-[46px] place-items-center rounded-full text-[24px] sm:text-[26px] ${isToday ? "text-white" : "text-[#1f1f1f] hover:bg-[#e9eef6]"}`}
                        style={isToday ? { background: BLUE } : undefined}>
                        {dayNum(d)}
                      </Link>
                    </div>
                  );
                })}
              </div>
              {/* Записи на весь день */}
              <div className="flex shrink-0 overflow-y-hidden border-b border-[#dde3ea] [scrollbar-gutter:stable]">
                <div className="flex w-14 shrink-0 items-end justify-end pb-1 pr-2 text-[10px] text-[#70757a]">{p.gmt}</div>
                {p.dates.map((d) => {
                  const list = notes.filter((n) => n.startDate <= d && n.endDate >= d);
                  return (
                    <div key={d} className="min-h-6 min-w-0 flex-1 cursor-pointer border-l border-[#dde3ea] py-0.5 pr-2"
                      onClick={(e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); openCreate(d, 540, 60, true, { left: r.left, right: r.right, top: r.top, bottom: r.bottom }); } }}>
                      {list.map((n) => (
                        <button key={n.id} type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setCreate(null); setPop({ kind: "note", id: n.id, anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }); }}
                          className="mb-0.5 block h-[22px] w-full truncate rounded-[4px] px-2 text-left text-[12px]"
                          style={{ background: calmBg(color(n.staffId)), color: textOn(color(n.staffId)) }}>
                          {n.title}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
              {/* Сетка по часам */}
              <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
                <div className="relative flex" style={{ height: 24 * hour }}>
                  <div className="relative w-14 shrink-0">
                    {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                      <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-[#70757a]" style={{ top: h * hour }}>{hhmm(h * 60)}</span>
                    ))}
                  </div>
                  {p.dates.map((d) => (
                    <DayColumn key={d} date={d} hour={hour} p={p} bookings={bookings} color={color} now={now} preview={preview} create={create} staffById={staffById}
                      register={(el) => { if (el) cols.current.set(d, el); else cols.current.delete(d); }}
                      onDown={beginDrag} onOpen={openEvent} />
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Меню на телефоне: виды, мини-календарь, календари */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <nav className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] overflow-y-auto bg-[#f8fafd] p-3 shadow-xl">
            <div className="flex items-center gap-2 px-2 py-3 text-[20px] text-[#444746]"><CalendarBlank size={26} weight="duotone" color={BLUE} /> Календарь</div>
            {VIEW_NAMES.map((v) => (
              <Link key={v.v} href={href(v.v, p.date)} onClick={() => setDrawer(false)}
                className={`flex h-12 items-center rounded-full px-4 text-[15px] ${p.view === v.v ? "bg-[#d3e3fd] font-medium text-[#041e49]" : "hover:bg-[#e9eef6]"}`}>
                {v.label}
              </Link>
            ))}
            <div className="my-3 border-t border-[#dde3ea]" />
            {miniMonth}
            {calendars}
          </nav>
        </div>
      )}

      {create && <CreatePopover c={create} setC={setCreate} staff={p.staff} save={saveCreate} />}
      {pop?.kind === "event" && (() => {
        const b = bookings.find((x) => x.id === pop.id);
        if (!b) return null;
        return (
          <EventPopover readOnly={p.readOnly} b={b} anchor={pop.anchor} staff={p.staff} color={color(b.staffId)} dayStarts={p.dayStarts} close={() => setPop(null)}
            onDelete={() => {
              setPop(null);
              setRemoved((s) => new Set(s).add(b.id));
              startTransition(async () => {
                await setBookingStatus(b.id, "cancelled");
                setToast({
                  text: "Запись удалена",
                  undo: () => startTransition(async () => { await setBookingStatus(b.id, "active", true); setToast(null); router.refresh(); }),
                });
                router.refresh();
              });
            }}
            onStaff={(staffId) => startTransition(async () => { await setBookingStaff(b.id, staffId); router.refresh(); })} />
        );
      })()}
      {pop?.kind === "note" && (() => {
        const n = notes.find((x) => x.id === pop.id);
        if (!n) return null;
        return (
          <NotePopover readOnly={p.readOnly} n={n} anchor={pop.anchor} staff={p.staff} color={color(n.staffId)} close={() => setPop(null)}
            onSave={(title, staffId) => startTransition(async () => {
              const r = await noteUpdate(n.id, { title, staffId, date: n.startDate, endDate: n.endDate });
              if (r.error) setToast({ text: r.error }); else setPop(null);
              router.refresh();
            })}
            onDelete={() => {
              setPop(null);
              setRemoved((s) => new Set(s).add(n.id));
              startTransition(async () => { await noteUpdate(n.id, null); setToast({ text: "Запись на весь день удалена" }); router.refresh(); });
            }} />
        );
      })()}

      {toast && (
        <div role="status" className="fixed bottom-[calc(96px+env(safe-area-inset-bottom,0px))] left-3 z-[60] flex max-w-[calc(100vw-24px)] items-center gap-4 rounded-md bg-[#303030] px-4 py-3 text-[14px] text-white shadow-lg lg:bottom-6 lg:left-6">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" onClick={toast.undo} className="font-medium text-[#a8c7fa]">Отменить</button>}
          <button type="button" aria-label="Закрыть" onClick={() => setToast(null)} className="text-white/70"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* ---------- колонка дня ---------- */

function DayColumn({ date, hour, p, bookings, color, now, preview, create, staffById, register, onDown, onOpen }: {
  date: string; hour: number; p: Props; bookings: CalBooking[]; color: (id: string | null) => string; now: number; preview: Preview | null; create: Create | null;
  staffById: Map<string, Staff>; register: (el: HTMLDivElement | null) => void; onDown: (e: React.PointerEvent, b: CalBooking | null, mode: Drag["mode"]) => void;
  onOpen: (id: string, el: HTMLElement) => void;
}) {
  const ds = p.dayStarts[date];
  const items = bookings
    .map((b) => {
      const pv = preview?.id === b.id ? preview : null;
      if (pv) return pv.date === date ? { b, s: pv.start, e: pv.start + pv.dur, dragging: true } : null;
      const s = (b.start - ds) / 60000, e = (b.end - ds) / 60000;
      return e > 0 && s < 1440 ? { b, s: Math.max(0, s), e: Math.min(1440, e), dragging: false } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const layout = googleLayout(items.map((x) => ({ id: x.b.id, start: x.s * 60000, end: x.e * 60000 })));
  const nowMin = (now - ds) / 60000;
  const ghost = create && !create.allDay && create.date === date ? create : preview && !preview.id && preview.date === date ? { start: preview.start, dur: preview.dur } : null;

  return (
    <div ref={register} className="relative min-w-0 flex-1 border-l border-[#dde3ea]"
      style={{ backgroundImage: "linear-gradient(#dde3ea 1px, transparent 1px)", backgroundSize: `100% ${hour}px` }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onDown(e, null, "create"); }}>
      {items.map(({ b, s, e, dragging }) => {
        const pos = layout.get(b.id)!;
        const dur = e - s;
        const past = b.end <= now && !dragging;
        const c = color(b.staffId);
        const bg = past ? pastBg(c) : calmBg(c);
        const fg = past ? "#3c4043" : textOn(c);
        const top = (s / 60) * hour, height = Math.max(16, (dur / 60) * hour - 1);
        const t1 = hhmm(Math.round(s)), t2 = hhmm(Math.round(e));
        const short = dur < 45;
        const lines = Math.max(1, Math.floor((height - 6) / 15) - 1);
        return (
          <div key={b.id} role="button" tabIndex={0} aria-label={`${t1}–${t2}, ${b.title}${b.site ? ", записался сам через сайт" : ""}`}
            onPointerDown={(ev) => onDown(ev, b, "move")}
            onClick={(ev) => { if (p.readOnly) onOpen(b.id, ev.currentTarget); }}
            onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(b.id, ev.currentTarget); } }}
            className={`absolute cursor-pointer select-none overflow-hidden rounded-[5px] border border-white px-1.5 text-[12px] leading-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#0b57d0] [touch-action:pan-y] ${short ? "py-px" : "py-0.5"} ${dragging ? "shadow-[0_6px_10px_rgba(60,64,67,.3)] opacity-90" : ""} ${b.status === "no_show" ? "line-through" : ""}`}
            style={{ top, height, left: `calc((100% - 10px) * ${pos.left})`, width: `calc((100% - 10px) * ${pos.width})`, zIndex: dragging ? 30 : pos.z, background: bg, color: fg }}>
            {short ? (
              <div className="truncate">{b.site && <Globe size={10} weight="bold" className="mr-0.5 inline align-[-1px]" />}<span>{b.title || "(Без названия)"}</span>, {t1}</div>
            ) : (
              <>
                <div className="overflow-hidden" style={{ maxHeight: lines * 15 }}>
                  {b.site && <Globe size={10} weight="bold" className="mr-0.5 inline align-[-1px]" />}{b.title || "(Без названия)"}
                </div>
                <div className="truncate opacity-90">{t1}–{t2}</div>
              </>
            )}
            {!b.id.startsWith("tmp-") && (
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize" onPointerDown={(ev) => { ev.stopPropagation(); onDown(ev, b, "resize"); }} />
            )}
          </div>
        );
      })}
      {ghost && (
        <div className="pointer-events-none absolute left-0 z-40 overflow-hidden rounded-[5px] border border-white px-1.5 py-0.5 text-[12px] leading-[15px] text-white shadow-[0_6px_10px_rgba(60,64,67,.3)]"
          style={{ top: (ghost.start / 60) * hour, height: Math.max(16, (ghost.dur / 60) * hour - 1), width: "calc(100% - 10px)", background: create?.staffId ? staffById.get(create.staffId)?.color ?? BLUE : "#039be5" }}>
          <div className="truncate font-medium">{create?.title || "(Без названия)"}</div>
          <div>{hhmm(ghost.start)}–{hhmm(ghost.start + ghost.dur)}</div>
        </div>
      )}
      {date === p.today && nowMin >= 0 && nowMin <= 1440 && (
        <div className="pointer-events-none absolute -left-1.5 right-0 z-[35] flex items-center" style={{ top: (nowMin / 60) * hour - 6 }}>
          <span className="size-3 rounded-full bg-[#ea4335]" />
          <span className="h-0.5 flex-1 bg-[#ea4335]" />
        </div>
      )}
    </div>
  );
}

/* ---------- месяц ---------- */

function MonthGrid({ p, bookings, notes, color, now, onDay, onEvent, onNote, onCreate }: {
  p: Props; bookings: CalBooking[]; notes: CalNote[]; color: (id: string | null) => string; now: number;
  onDay: (d: string) => void; onEvent: (id: string, el: HTMLElement) => void; onNote: (id: string, el: HTMLElement) => void; onCreate: (d: string, el: HTMLElement) => void;
}) {
  const weeks = p.dates.length / 7;
  const MAX = 3;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7">
        {p.dates.slice(0, 7).map((d) => <span key={d} className="border-l border-[#dde3ea] pt-2 text-center text-[11px] font-medium text-[#444746] first:border-l-0">{WD[weekdayOf(d)]}</span>)}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {p.dates.map((d, i) => {
          const ds = p.dayStarts[d];
          const dn = notes.filter((n) => n.startDate <= d && n.endDate >= d);
          const db = bookings.filter((b) => b.start >= ds && b.start < ds + 86400000).sort((x, y) => x.start - y.start);
          const all = [...dn.map((n) => ({ kind: "note" as const, n })), ...db.map((b) => ({ kind: "b" as const, b }))];
          const out = d < p.monthStart || d > p.monthEnd;
          const isToday = d === p.today;
          return (
            <div key={d} className={`flex min-h-[88px] min-w-0 cursor-pointer flex-col border-b border-[#dde3ea] ${i % 7 ? "border-l" : ""}`}
              onClick={(e) => { if (e.target === e.currentTarget) onCreate(d, e.currentTarget); }}>
              <button type="button" onClick={() => onDay(d)} aria-label={longDate(d)}
                className={`mx-auto mt-1 grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] font-medium ${isToday ? "text-white" : out ? "text-[#70757a] hover:bg-[#e9eef6]" : "text-[#1f1f1f] hover:bg-[#e9eef6]"}`}
                style={isToday ? { background: BLUE } : undefined}>
                {dayNum(d) === 1 ? `${dayNum(d)} ${MONTHS_SHORT[monthIdx(d)]}` : dayNum(d)}
              </button>
              <div className="min-w-0 px-1 pb-1" onClick={(e) => { if (e.target === e.currentTarget) onCreate(d, e.currentTarget.parentElement!); }}>
                {all.slice(0, MAX).map((x) => x.kind === "note" ? (
                  <button key={x.n.id} type="button" onClick={(e) => onNote(x.n.id, e.currentTarget)}
                    className="mb-px block h-5 w-full truncate rounded-[4px] px-1.5 text-left text-[12px]"
                    style={{ background: calmBg(color(x.n.staffId)), color: textOn(color(x.n.staffId)) }}>{x.n.title}</button>
                ) : (
                  <button key={x.b.id} type="button" onClick={(e) => onEvent(x.b.id, e.currentTarget)}
                    className={`mb-px flex h-5 w-full min-w-0 items-center gap-1 rounded-[4px] px-1 text-left text-[12px] hover:bg-[#f1f3f4] ${x.b.end <= now ? "opacity-60" : ""} ${x.b.status === "no_show" ? "line-through" : ""}`}>
                    <i className="size-2 shrink-0 rounded-full" style={{ background: color(x.b.staffId) }} />
                    <span className="shrink-0 text-[#444746]">{hhmm(Math.round((x.b.start - ds) / 60000))}</span>
                    <span className="truncate">{x.b.title}</span>
                  </button>
                ))}
                {all.length > MAX && (
                  <button type="button" onClick={() => onDay(d)} className="block h-5 w-full rounded-[4px] px-1 text-left text-[12px] font-medium text-[#1f1f1f] hover:bg-[#f1f3f4]">
                    Ещё {all.length - MAX}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- мини-календарь ---------- */

function MiniMonth({ month, setMonth, today, from, to, onPick, onRange }: {
  month: string; setMonth: (m: string) => void; today: string; from: string; to: string; onPick: (d: string) => void; onRange: (a: string, z: string) => void;
}) {
  const start = addDays(month, 1 - weekdayOf(month));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  // Как в Google: зажали день и провели мышкой — показываются выделенные дни; просто нажали — этот день
  const [sel, setSel] = useState<{ a: string; b: string } | null>(null);
  useEffect(() => {
    if (!sel) return;
    const up = () => {
      const [x, y] = sel.a <= sel.b ? [sel.a, sel.b] : [sel.b, sel.a];
      setSel(null);
      if (x === y) onPick(x); else onRange(x, y);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [sel, onPick, onRange]);
  const [lo, hi] = sel ? (sel.a <= sel.b ? [sel.a, sel.b] : [sel.b, sel.a]) : [from, to];
  return (
    <div className="px-2">
      <div className="mb-1 flex items-center justify-between pl-2">
        <span className="text-[14px] font-medium">{MONTHS[monthIdx(month)]} {month.slice(0, 4)}</span>
        <span className="flex">
          <button type="button" aria-label="Прошлый месяц" onClick={() => setMonth(prevMonth(month))} className="grid size-7 place-items-center rounded-full text-[#444746] hover:bg-[#e9eef6]"><CaretLeft size={14} /></button>
          <button type="button" aria-label="Следующий месяц" onClick={() => setMonth(nextMonth(month))} className="grid size-7 place-items-center rounded-full text-[#444746] hover:bg-[#e9eef6]"><CaretRight size={14} /></button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-[#444746]">
        {WD_MINI.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 text-center">
        {days.map((d) => {
          const isToday = d === today, inRange = d >= lo && d <= hi, out = d.slice(0, 7) !== month.slice(0, 7);
          return (
            <button key={d} type="button" aria-label={longDate(d)}
              onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); setSel({ a: d, b: d }); }}
              onPointerEnter={() => { if (sel) setSel({ a: sel.a, b: d }); }}
              // С клавиатуры (Enter, пробел) — просто этот день; мышь и палец обрабатывает pointerup выше
              onClick={(e) => { if (e.detail === 0) onPick(d); }}
              className={`mx-auto my-px grid size-7 place-items-center rounded-full text-[11.5px] ${isToday ? "font-medium text-white" : inRange ? "bg-[#d3e3fd] text-[#041e49]" : out ? "text-[#70757a] hover:bg-[#e9eef6]" : "text-[#1f1f1f] hover:bg-[#e9eef6]"}`}
              style={isToday ? { background: BLUE } : undefined}>
              {dayNum(d)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- всплывающие окна ---------- */

/** Окно рядом с записью, как в Google; на телефоне — снизу экрана. */
function Floating({ anchor, width, close, children, label }: { anchor: Anchor | null; width: number; close: () => void; children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Сначала окно меряется нужной ширины невидимым, потом ставится рядом с записью так, чтобы влезло в экран
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden", width, left: 0, top: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw < 640) { setStyle({ visibility: "visible" }); return; }
    if (style.visibility !== "hidden") return;
    const h = el.offsetHeight;
    let left: number, top: number;
    if (!anchor) { left = (vw - width) / 2; top = Math.max(12, (vh - h) / 2); }
    else {
      left = anchor.right + 12 + width <= vw - 12 ? anchor.right + 12 : anchor.left - 12 - width;
      if (left < 12) left = clamp(anchor.left, 12, vw - width - 12);
      top = clamp(anchor.top - 8, 12, vh - h - 12);
    }
    setStyle({ left, top, width });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, width]);
  // Курсор в первое поле, когда окно уже видно (у скрытого поля фокуса нет)
  useEffect(() => { if (style.visibility !== "hidden") ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(); }, [style]);
  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/25 sm:bg-transparent" onPointerDown={close} />
      <div ref={ref} role="dialog" aria-label={label}
        className="fixed inset-x-0 bottom-0 z-[56] max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-[#f0f4f9] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_4px_8px_3px_rgba(60,64,67,.15),0_1px_3px_rgba(60,64,67,.3)] sm:inset-x-auto sm:bottom-auto sm:rounded-[28px]"
        style={style}>
        {children}
      </div>
    </>
  );
}

function CreatePopover({ c, setC, staff, save }: { c: Create; setC: (c: Create | null) => void; staff: Staff[]; save: (c: Create) => string | null }) {
  const [error, setError] = useState<string | null>(null);
  const submit = () => { const e = save(c); if (e) setError(e); };
  const more = `/cabinet/new?date=${c.date}&time=${hhmm(c.start)}${c.staffId ? `&staff=${c.staffId}` : ""}&back=week`;
  const end = c.start + c.dur;
  return (
    <Floating anchor={c.anchor} width={448} close={() => setC(null)} label="Новая запись">
      <div className="flex justify-end px-3 pt-2">
        <button type="button" aria-label="Закрыть" onClick={() => setC(null)} className="grid size-10 place-items-center rounded-full text-[#444746] hover:bg-black/5"><X size={20} /></button>
      </div>
      <form className="px-6 pb-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input data-autofocus value={c.title} onChange={(e) => { setC({ ...c, title: e.target.value }); setError(null); }} maxLength={400} aria-label="Запись"
          placeholder="Добавьте название" className="w-full border-b border-[#747775] bg-transparent pb-1.5 pl-1 text-[22px] outline-none placeholder:text-[#5e5e5e] focus:border-b-2 focus:border-[#0b57d0]" />
        <p className="mt-1 pl-1 text-[12px] text-[#444746]">Что делаем, клиент, машина, телефон — как раньше в Google</p>
        <div className="mt-4 grid gap-3 text-[14px]">
          <div className="flex items-start gap-4">
            <Clock size={20} className="mt-2 shrink-0 text-[#444746]" />
            <div className="grid gap-2">
              <span className="pt-1.5">{longDate(c.date)}</span>
              {!c.allDay && (
                <div className="flex items-center gap-2">
                  <select aria-label="Начало" value={c.start} onChange={(e) => setC({ ...c, start: Number(e.target.value) })} className="h-9 rounded-md bg-[#e1e5ea]/70 px-2 hover:bg-[#dde3ea]">
                    {TIMES.map((t) => <option key={t} value={t}>{hhmm(t)}</option>)}
                  </select>
                  –
                  <select aria-label="Конец" value={end} onChange={(e) => setC({ ...c, dur: Math.max(SNAP, Number(e.target.value) - c.start) })} className="h-9 rounded-md bg-[#e1e5ea]/70 px-2 hover:bg-[#dde3ea]">
                    {[...TIMES, 1440].filter((t) => t > c.start).map((t) => <option key={t} value={t}>{hhmm(t)}</option>)}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={c.allDay} onChange={(e) => setC({ ...c, allDay: e.target.checked })} className="size-[18px] accent-[#0b57d0]" />
                Весь день
              </label>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <CalendarBlank size={20} className="shrink-0 text-[#444746]" />
            <span className="relative flex items-center">
              <i className="pointer-events-none absolute left-2.5 size-3 rounded-full" style={{ background: staff.find((s) => s.id === c.staffId)?.color ?? "#039be5" }} />
              <select aria-label="Пост" value={c.staffId} onChange={(e) => setC({ ...c, staffId: e.target.value })} className="h-9 rounded-md bg-[#e1e5ea]/70 pl-7 pr-2 hover:bg-[#dde3ea]">
                <option value="">Любой свободный</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </span>
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-[13px] text-[#b3261e]">{error}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          {!c.allDay && <Link href={more} className="h-10 rounded-full px-4 text-[14px] font-medium leading-10 text-[#0b57d0] hover:bg-[#0b57d0]/10">Другие параметры</Link>}
          <button className="h-10 rounded-full bg-[#0b57d0] px-6 text-[14px] font-medium text-white hover:shadow-md">Сохранить</button>
        </div>
      </form>
    </Floating>
  );
}

function EventPopover({ b, anchor, staff, color, dayStarts, close, onDelete, onStaff, readOnly }: {
  readOnly?: boolean; b: CalBooking; anchor: Anchor; staff: Staff[]; color: string; dayStarts: Record<string, number>; close: () => void; onDelete: () => void; onStaff: (id: string | null) => void;
}) {
  const date = Object.keys(dayStarts).find((d) => b.start >= dayStarts[d] && b.start < dayStarts[d] + 86400000) ?? Object.keys(dayStarts)[0];
  const ds = dayStarts[date];
  const when = `${longDate(date)} ⋅ ${hhmm(Math.round((b.start - ds) / 60000))}–${hhmm(Math.min(1440, Math.round((b.end - ds) / 60000)))}`;
  const icon = "grid size-10 place-items-center rounded-full text-[#444746] hover:bg-black/5";
  return (
    <Floating anchor={anchor} width={448} close={close} label="Запись">
      <div className="flex justify-end gap-0.5 px-2 pt-2">
        {!readOnly && (
          <>
            <Link href={`/cabinet/b/${b.id}/edit`} aria-label="Изменить" title="Изменить" className={icon}><PencilSimple size={20} /></Link>
            <button type="button" aria-label="Удалить" title="Удалить" onClick={onDelete} className={icon}><Trash size={20} /></button>
            <Link href={`/cabinet/b/${b.id}`} aria-label="Подробнее" title="Подробнее: выполнена, не приехал" className={icon}><DotsThreeVertical size={20} weight="bold" /></Link>
          </>
        )}
        <button type="button" aria-label="Закрыть" onClick={close} className={icon}><X size={20} /></button>
      </div>
      <div className="grid gap-4 px-6 pb-6 pt-1 text-[14px] text-[#1f1f1f]">
        <div className="flex gap-4">
          <span className="mt-2 size-3.5 shrink-0 rounded-[4px]" style={{ background: color }} />
          <div className="min-w-0">
            <h2 className={`break-words text-[22px] leading-7 ${b.status === "no_show" ? "line-through" : ""}`}>{b.title || "(Без названия)"}</h2>
            <p className="mt-1 text-[#444746]">{when}</p>
            {b.status !== "active" && <p className="mt-1 text-[#444746]">{b.status === "done" ? "Выполнена" : b.status === "no_show" ? "Не приехал" : "Отменена"}</p>}
          </div>
        </div>
        {b.phone && (
          <a href={`tel:${b.phone}`} className="flex items-center gap-4 text-[#0b57d0] hover:underline">
            <Phone size={20} className="shrink-0 text-[#444746]" /> Позвонить {b.phoneText}
          </a>
        )}
        <div className="flex items-center gap-4">
          <CalendarBlank size={20} className="shrink-0 text-[#444746]" />
          {readOnly ? <span>{staff.find((s) => s.id === b.staffId)?.name ?? "Любой свободный"}</span> : <select aria-label="Пост" value={b.ownStaff ? b.staffId : ""} onChange={(e) => onStaff(e.target.value || null)} className="h-9 rounded-md bg-[#e1e5ea]/70 px-2 hover:bg-[#dde3ea]">
            {!b.ownStaff && <option value="">{staff.find((s) => s.id === b.staffId)?.name ?? "Любой свободный"}</option>}
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>}
        </div>
        {b.author && (
          <div className="flex items-center gap-4 text-[#444746]">
            {b.site ? <Globe size={20} className="shrink-0" /> : <User size={20} className="shrink-0" />} {b.author}
          </div>
        )}
      </div>
    </Floating>
  );
}

function NotePopover({ n, anchor, staff, color, close, onSave, onDelete, readOnly }: {
  readOnly?: boolean; n: CalNote; anchor: Anchor; staff: Staff[]; color: string; close: () => void; onSave: (title: string, staffId: string | null) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(n.title);
  const [staffId, setStaffId] = useState(n.staffId ?? "");
  const when = n.startDate === n.endDate ? longDate(n.startDate) : `${dayNum(n.startDate)} ${MONTHS_GEN[monthIdx(n.startDate)]} – ${dayNum(n.endDate)} ${MONTHS_GEN[monthIdx(n.endDate)]}`;
  const icon = "grid size-10 place-items-center rounded-full text-[#444746] hover:bg-black/5";
  return (
    <Floating anchor={anchor} width={448} close={close} label="Запись на весь день">
      <div className="flex justify-end gap-0.5 px-2 pt-2">
        {!readOnly && <button type="button" aria-label="Удалить" title="Удалить" onClick={onDelete} className={icon}><Trash size={20} /></button>}
        <button type="button" aria-label="Закрыть" onClick={close} className={icon}><X size={20} /></button>
      </div>
      <form className="grid gap-4 px-6 pb-6 pt-1 text-[14px]" onSubmit={(e) => { e.preventDefault(); if (!readOnly) onSave(title, staffId || null); }}>
        <fieldset disabled={readOnly} className="contents">
        <div className="flex gap-4">
          <span className="mt-3 size-3.5 shrink-0 rounded-[4px]" style={{ background: color }} />
          <div className="min-w-0 flex-1">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Текст"
              className="w-full border-b border-transparent bg-transparent pb-1 text-[22px] outline-none hover:border-[#747775] focus:border-b-2 focus:border-[#0b57d0]" />
            <p className="mt-1 text-[#444746]">{when} ⋅ весь день</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <CalendarBlank size={20} className="shrink-0 text-[#444746]" />
          <select aria-label="Пост" value={staffId} onChange={(e) => setStaffId(e.target.value)} className="h-9 rounded-md bg-[#e1e5ea]/70 px-2 hover:bg-[#dde3ea]">
            <option value="">Без поста</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {!readOnly && (title !== n.title || staffId !== (n.staffId ?? "")) && (
          <div className="flex justify-end"><button className="h-10 rounded-full bg-[#0b57d0] px-6 text-[14px] font-medium text-white">Сохранить</button></div>
        )}
        </fieldset>
      </form>
    </Floating>
  );
}
