"use client";

// Разделы услуг, которые раскрываются по нажатию: значок, название, «4 варианта записи» (образец от клиента).
// Внутри раздела — подразделы («Развал-схождение / Седан»): тоже раскрываются, в них уже услуги с ценами.
import { Fragment, useState } from "react";
import {
  CaretDown, Car, CarProfile, Disc, Drop, Engine, Lightning, MagnifyingGlass, Snowflake, Sliders, Thermometer, Tire, Wrench,
} from "@phosphor-icons/react";
import { splitCategory } from "@/lib/service-display";

/** Значок раздела по его названию; незнакомый раздел — гаечный ключ. */
function CategoryIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const Icon = /диагност|осмотр/.test(n) ? MagnifyingGlass
    : /шин|колес|колёс/.test(n) ? Tire
    : /развал|сход/.test(n) ? Sliders
    : /подвес|ходов/.test(n) ? CarProfile
    : /тормоз/.test(n) ? Disc
    : /охлажд|темпер/.test(n) ? Thermometer
    : /двигат|мотор|грм/.test(n) ? Engine
    : /масл|жидкост/.test(n) ? Drop
    : /электр|аккумул/.test(n) ? Lightning
    : /кондиц|климат/.test(n) ? Snowflake
    : /кузов|мойк/.test(n) ? Car
    : Wrench;
  return <Icon size={22} aria-hidden />;
}

const variants = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? "вариант" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "варианта" : "вариантов"} записи`;

type Item = { id: string; category: string };

/** Подразделы раздела по порядку появления; услуги без подраздела — одним списком на своём месте. */
function parts<T extends Item>(list: T[]) {
  const out: { sub: string | null; key: string; list: T[] }[] = [];
  for (const s of list) {
    const sub = splitCategory(s.category)[1];
    const same = sub ? out.find((p) => p.sub === sub) : out.at(-1)?.sub === null ? out.at(-1) : undefined;
    if (same) same.list.push(s);
    else out.push({ sub, key: s.category, list: [s] });
  }
  return out;
}

/** Разделы по порядку появления; у каждого свои услуги. Один раздел — без раскрытия, сразу список. */
export function Categories<T extends Item>({ items, openFirst, openWith, children }: {
  items: T[]; openFirst?: boolean; openWith?: string | null; children: (list: T[]) => React.ReactNode;
}) {
  const top = (s: T) => splitCategory(s.category)[0];
  const names = [...new Set(items.map(top))];
  const chosen = items.find((s) => s.id === openWith)?.category;
  // Ключ раскрытия: раздел — его название, подраздел — полное «Раздел / Подраздел»
  const [open, setOpen] = useState<Set<string>>(() => new Set(chosen ? [splitCategory(chosen)[0], chosen] : openFirst ? names.slice(0, 1) : []));
  const toggle = (c: string) => setOpen((s) => { const x = new Set(s); if (x.has(c)) x.delete(c); else x.add(c); return x; });

  const head = (key: string, title: string, count: number, sub: boolean) => (
    <button type="button" className={`cat-head${sub ? " sub" : ""}`} aria-expanded={open.has(key)} onClick={() => toggle(key)}>
      {!sub && <span className="ic"><CategoryIcon name={title} /></span>}
      <span className="t"><b>{title}</b><small>{variants(count)}</small></span>
      <CaretDown size={18} className="chev" aria-hidden />
    </button>
  );
  // Содержимое раздела: один подраздел или только услуги — сразу список, лишнего нажатия нет
  const body = (list: T[]) => {
    const ps = parts(list);
    if (ps.length === 1) return children(list);
    return ps.map((p) =>
      p.sub === null ? (
        <Fragment key={`${p.key}#${p.list[0].id}`}>{children(p.list)}</Fragment>
      ) : (
        <div className="cat sub" key={p.key}>
          {head(p.key, p.sub, p.list.length, true)}
          {open.has(p.key) && <div className="cat-body">{children(p.list)}</div>}
        </div>
      ),
    );
  };

  if (names.length < 2) return <>{body(items)}</>;
  return (
    <div className="cat-list">
      {names.map((c) => {
        const list = items.filter((s) => top(s) === c);
        return (
          <div className="cat" key={c}>
            {head(c, c, list.length, false)}
            {open.has(c) && <div className="cat-body">{body(list)}</div>}
          </div>
        );
      })}
    </div>
  );
}
