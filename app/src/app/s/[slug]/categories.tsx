"use client";

// Разделы услуг, которые раскрываются по нажатию: значок, название, «4 варианта записи» (образец от клиента).
import { useState } from "react";
import {
  CaretDown, Car, CarProfile, Disc, Drop, Engine, Lightning, MagnifyingGlass, Snowflake, Sliders, Thermometer, Tire, Wrench,
} from "@phosphor-icons/react";

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

/** Разделы по порядку появления; у каждого свои услуги. Один раздел — без раскрытия, сразу список. */
export function Categories<T extends { id: string; category: string }>({ items, openFirst, openWith, children }: {
  items: T[]; openFirst?: boolean; openWith?: string | null; children: (list: T[]) => React.ReactNode;
}) {
  const names = [...new Set(items.map((s) => s.category))];
  const withChosen = items.find((s) => s.id === openWith)?.category;
  const [open, setOpen] = useState<Set<string>>(() => new Set(withChosen ? [withChosen] : openFirst ? names.slice(0, 1) : []));
  if (names.length < 2) return <>{children(items)}</>;
  const toggle = (c: string) => setOpen((s) => { const x = new Set(s); if (x.has(c)) x.delete(c); else x.add(c); return x; });
  return (
    <div className="cat-list">
      {names.map((c) => {
        const list = items.filter((s) => s.category === c);
        const on = open.has(c);
        return (
          <div className="cat" key={c}>
            <button type="button" className="cat-head" aria-expanded={on} onClick={() => toggle(c)}>
              <span className="ic"><CategoryIcon name={c} /></span>
              <span className="t"><b>{c}</b><small>{variants(list.length)}</small></span>
              <CaretDown size={18} className="chev" aria-hidden />
            </button>
            {on && <div className="cat-body">{children(list)}</div>}
          </div>
        );
      })}
    </div>
  );
}
