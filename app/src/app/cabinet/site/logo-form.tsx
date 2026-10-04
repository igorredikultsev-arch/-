"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { ImageSquare, Trash } from "@phosphor-icons/react";
import { removeLogo, uploadLogo } from "../actions";
import { btnPrimary, btnSecondary } from "../ui";
import { Result } from "./result";

const MAX_SIDE = 512;

/** Уменьшает картинку в браузере до 512 точек по длинной стороне и сохраняет в PNG (прозрачный фон не теряется). */
async function shrink(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
    if (!blob) throw new Error("png");
    return new File([blob], "logo.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoForm({ current, name, headline }: { current: string | null; name: string; headline: string }) {
  const [state, upload, pending] = useActionState(uploadLogo, null);
  const [removeState, remove, removing] = useActionState(removeLogo, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const shown = preview ?? (removeState?.ok ? null : current);

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Подходят картинки PNG, JPG или WebP");
    try {
      const small = await shrink(file);
      setPreview(URL.createObjectURL(small));
      const form = new FormData();
      form.set("logo", small);
      startTransition(() => upload(form));
    } catch {
      setError("Не получилось открыть картинку. Попробуйте другой файл");
    }
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { bg: "bg-white text-ink", sub: "text-zinc-500", label: "На светлом сайте" },
          { bg: "bg-[#24272c] text-white", sub: "text-white/60", label: "На тёмном сайте" },
        ].map((v) => (
          <figure key={v.label} className="grid gap-1.5">
            <div className={`flex min-h-20 items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 ${v.bg}`}>
              {shown ? (
                // eslint-disable-next-line @next/next/no-img-element -- картинка из формы или с нашего же адреса, оптимизация не нужна
                <img src={shown} alt="" className="h-11 w-auto max-w-[110px] shrink-0 rounded-lg object-contain" />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-dashed border-current opacity-40"><ImageSquare size={22} /></span>
              )}
              <span className="min-w-0">
                <b className="block truncate text-[14.5px]">{name}</b>
                <span className={`block truncate text-[12.5px] ${v.sub}`}>{headline}</span>
              </span>
            </div>
            <figcaption className="px-1 text-[12.5px] text-zinc-500">{v.label}</figcaption>
          </figure>
        ))}
      </div>

      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Файл логотипа" />
      <button type="button" disabled={pending} onClick={() => input.current?.click()} className={btnPrimary}>
        <ImageSquare size={20} /> {pending ? "Загружаем…" : shown ? "Заменить логотип" : "Загрузить логотип"}
      </button>
      {error && <Result state={{ error }} />}
      <Result state={state} />
      {shown && !pending && (
        <form action={remove}>
          <button disabled={removing} className={`${btnSecondary} w-full`}><Trash size={18} /> Убрать логотип</button>
        </form>
      )}
      <Result state={removeState} />
      <p className="text-[13px] leading-snug text-zinc-500">
        Подойдёт картинка PNG или JPG, лучше квадратная или вытянутая в ширину, на прозрачном или белом фоне. Можно сфотографировать вывеску. Логотип
        появится в шапке сайта и на вкладке браузера. Без логотипа сайт показывает только название.
      </p>
    </div>
  );
}
