"use client";

import { useActionState, useState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, null);
  const [phone, setPhone] = useState("+7");
  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5" htmlFor="phone">
        <span className="text-sm font-semibold">Телефон</span>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} required
          className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-accent" />
      </label>
      <label className="grid gap-1.5" htmlFor="password">
        <span className="text-sm font-semibold">Пароль</span>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-accent" />
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <button disabled={pending} className="h-13 rounded-xl bg-accent py-3.5 text-base font-semibold text-white disabled:opacity-60">
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
