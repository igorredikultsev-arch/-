"use client";

import { useActionState, useState } from "react";
import { cancelAction } from "./actions";

export function CancelForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(cancelAction.bind(null, token), null);
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button className="cancel" type="button" onClick={() => setConfirm(true)}>
        Отменить запись
      </button>
    );
  }
  return (
    <form action={action} className="keep" style={{ display: "grid", gap: 10 }}>
      <b>Отменить запись?</b>
      <span>Время освободится, и его смогут занять другие.</span>
      {error && <span className="form-err" role="alert">{error}</span>}
      <div className="two" style={{ marginTop: 0 }}>
        <button className="btn alt" type="button" onClick={() => setConfirm(false)}>
          Оставить
        </button>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Отменяем…" : "Да, отменить"}
        </button>
      </div>
    </form>
  );
}
