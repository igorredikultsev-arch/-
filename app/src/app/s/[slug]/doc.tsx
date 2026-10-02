type Section = { h?: string; p: string[] };

export function Doc({ title, sections, back }: { title: string; sections: Section[]; back: string }) {
  return (
    <article className="doc">
      <a className="back" href={back}>
        Вернуться на сайт
      </a>
      <h1>{title}</h1>
      {sections.map((s, i) => (
        <section key={i}>
          {s.h && <h2>{s.h}</h2>}
          {s.p.map((t, j) => (
            <p key={j}>{t}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
