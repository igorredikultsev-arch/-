import Link from "next/link";
import type { Section } from "@/lib/legal";

/** Документ на основном домене avtoslot.ru: оферта и политика сервиса. */
export function LegalPage({ title, sections }: { title: string; sections: Section[] }) {
  return (
    <main className="min-h-dvh bg-white px-4 py-10 text-ink sm:px-8">
      <article className="mx-auto grid max-w-[44rem] gap-6 leading-relaxed">
        <Link href="/" className="text-[15px] font-semibold text-zinc-600 underline underline-offset-4">
          На главную
        </Link>
        <h1 className="text-[clamp(1.7rem,4vw,2.3rem)] font-extrabold leading-tight tracking-tight text-balance">{title}</h1>
        {sections.map((s, i) => (
          <section key={i} className="grid gap-2">
            {s.h && <h2 className="text-[18px] font-bold">{s.h}</h2>}
            {s.p.map((t, j) => (
              <p key={j} className="text-[16px] text-zinc-700">{t}</p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
