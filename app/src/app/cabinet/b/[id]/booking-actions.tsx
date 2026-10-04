"use client";

import { useState, useTransition } from "react";
import { erasePersonalData, setBookingStatus } from "../../actions";
import { btnSecondary } from "../../ui";

type Status = "active" | "cancelled" | "no_show" | "done";

export function BookingActions({ id, status, hasPd, started }: { id: string; status: Status; hasPd: boolean; started: boolean }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | "cancel" | "erase">(null);
  const [warning, setWarning] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setConfirm(null); });
  const restore = (force: boolean) =>
    start(async () => {
      const r = await setBookingStatus(id, "active", force);
      setWarning(r?.warning ?? null);
    });

  if (warning) {
    return (
      <div className="grid gap-3 rounded-2xl bg-orange-50 p-4 text-[14px] text-orange-950">
        <b>{warning}</b>
        <span>Пока запись была отменена, это время могли занять. Если вернуть, в одно время окажется больше машин, чем постов.</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btnSecondary} onClick={() => setWarning(null)}>Не возвращать</button>
          <button type="button" disabled={pending} className={`${btnSecondary} !bg-orange-600 !text-white`} onClick={() => restore(true)}>
            {pending ? "…" : "Вернуть"}
          </button>
        </div>
      </div>
    );
  }

  if (confirm) {
    return (
      <div className="grid gap-3 rounded-2xl bg-orange-50 p-4 text-[14px] text-orange-950">
        <b>{confirm === "cancel" ? "Отменить запись?" : "Удалить данные клиента?"}</b>
        <span>
          {confirm === "cancel"
            ? "Время освободится на сайте. Клиенту сообщите сами, если нужно."
            : "Имя, телефон, машина и комментарий будут стёрты без возможности восстановить. Время и услуга останутся в статистике."}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btnSecondary} onClick={() => setConfirm(null)}>Нет</button>
          <button type="button" disabled={pending} className={`${btnSecondary} !bg-orange-600 !text-white`}
            onClick={() => run(() => (confirm === "cancel" ? setBookingStatus(id, "cancelled") : erasePersonalData(id)))}>
            {pending ? "…" : confirm === "cancel" ? "Отменить" : "Удалить"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {status === "active" ? (
        <>
          {/* «Выполнена» и «Не приехал» — только когда время записи наступило, чтобы случайно не освободить будущее время */}
          {started && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={pending} className={btnSecondary} onClick={() => run(() => setBookingStatus(id, "done"))}>Выполнена</button>
              <button type="button" disabled={pending} className={btnSecondary} onClick={() => run(() => setBookingStatus(id, "no_show"))}>Не приехал</button>
            </div>
          )}
          <button type="button" className={btnSecondary} onClick={() => setConfirm("cancel")}>Отменить запись</button>
        </>
      ) : (
        <button type="button" disabled={pending} className={btnSecondary} onClick={() => restore(false)}>Вернуть в активные</button>
      )}
      {hasPd && (
        <button type="button" className="min-h-11 text-[13.5px] font-semibold text-zinc-500 underline underline-offset-4" onClick={() => setConfirm("erase")}>
          Удалить данные клиента по его просьбе
        </button>
      )}
    </div>
  );
}
