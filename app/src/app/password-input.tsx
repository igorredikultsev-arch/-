"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";

/** Поле пароля с кнопкой «Показать»: владелец вводит пароль из сообщения с телефона и может проверить, что набрал. */
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${className} w-full pr-12`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-zinc-500 hover:text-zinc-800"
      >
        {shown ? <EyeSlash size={22} /> : <Eye size={22} />}
      </button>
    </div>
  );
}
