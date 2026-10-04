"use client";

import { useState } from "react";
import { deleteService } from "../../../actions";

/** Удаление в два нажатия: случайный тап не стирает услугу. */
export function DeleteService({ id, name }: { id: string; name: string }) {
  const [ask, setAsk] = useState(false);
  if (!ask) {
    return (
      <button type="button" onClick={() => setAsk(true)} className="min-h-11 w-full text-[14px] font-semibold text-red-700 underline underline-offset-4">
        Удалить услугу
      </button>
    );
  }
  return (
    <form action={deleteService.bind(null, id)} className="grid gap-2 rounded-2xl bg-red-50 p-4 text-[14px] text-red-900">
      <p>Удалить «{name}»? С сайта она пропадёт сразу.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAsk(false)} className="min-h-11 rounded-xl bg-white font-semibold text-ink">Нет</button>
        <button className="min-h-11 rounded-xl bg-red-700 font-semibold text-white">Да, удалить</button>
      </div>
    </form>
  );
}
