"use client";

import { useActionState } from "react";
import { changePassword } from "../actions";
import { Field, inputCls, Notice } from "../ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="grid gap-3">
      <Field label="Текущий пароль" htmlFor="pw-cur"><input id="pw-cur" name="current" type="password" autoComplete="current-password" required className={inputCls} /></Field>
      <Field label="Новый пароль, от 8 символов" htmlFor="pw-new"><input id="pw-new" name="next" type="password" autoComplete="new-password" minLength={8} required className={inputCls} /></Field>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.message}</Notice>}
      <button disabled={pending} className="rounded-xl bg-zinc-200/70 py-3 text-[15px] font-semibold">Сменить пароль</button>
    </form>
  );
}
