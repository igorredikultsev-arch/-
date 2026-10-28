"use client";

import { useActionState } from "react";
import { moveFromClosed } from "../actions";
import { Result } from "../site/result";

/** Переставить клиентов закрытого сотрудника к свободным мастерам: одна кнопка под предупреждением */
export function MoveButton({ staffId }: { staffId: string }) {
  const [state, action, pending] = useActionState(moveFromClosed.bind(null, staffId), null);
  return (
    <form action={action} className="grid gap-2">
      <button disabled={pending} className="min-h-11 rounded-xl bg-white px-4 text-[14.5px] font-semibold ring-1 ring-orange-200 hover:bg-orange-100">
        {pending ? "Переставляем…" : "Переставить на свободные посты"}
      </button>
      <Result state={state} />
    </form>
  );
}
