/* Общая часть макетов: данные демо «Колесо» и разметка ниже первого экрана.
   Каждое направление оформляет её своими переменными (--bg, --fg, --accent…) и стилями.
   AS.render(el, {pick:true}) — радиус, запись, услуги, отзывы, контакты, подвал. */
(function () {
  const BIZ = {
    name: "Шиномонтаж «Колесо»", short: "Колесо", city: "Пермь", address: "ул. Примерная, 12",
    note: "Въезд со двора, ворота с вывеской", phone: "+7 (342) 254-18-73", rating: "4,8", reviews: 126, ya: 98, gis: 28,
    hours: ["Пн-Пт 9:00-20:00", "Сб 10:00-18:00", "Вс выходной"], open: "Открыто до 20:00",
  };
  const BANDS = [
    { from: 13, to: 16, name: "Смена колёс R13-R16", price: 1600, dur: "Около 40 минут", min: 40 },
    { from: 17, to: 19, name: "Смена колёс R17-R19", price: 2200, dur: "Около 50 минут", min: 50 },
    { from: 20, to: 22, name: "Смена колёс R20 и больше", price: 3000, dur: "Около часа", min: 60 },
  ];
  const SERVICES = [
    ["Шиномонтаж", "Смена колёс R13-R16", "Снять, разбортировать, отбалансировать. Около 40 минут", 1600],
    ["Шиномонтаж", "Смена колёс R17-R19", "Кроссоверы и крупные седаны. Около 50 минут", 2200],
    ["Шиномонтаж", "Смена колёс R20 и больше", "Внедорожники и низкий профиль. Около часа", 3000],
    ["Шиномонтаж", "Балансировка 4 колёс", "Около 30 минут", 800],
    ["Шиномонтаж", "Ремонт прокола", "Около 30 минут", 400],
    ["Развал", "Развал-схождение", "Около часа", 1500],
    ["ТО и масло", "Замена масла в двигателе", "Около 30 минут", 600],
    ["Диагностика", "Диагностика ходовой", "Около 30 минут", 500],
  ];
  const DAYS = [["Ср", 14, "сегодня"], ["Чт", 15], ["Пт", 16], ["Сб", 17], ["Пн", 19], ["Вт", 20], ["Ср", 21]];
  const SLOTS = ["13:20", "13:40", "14:00", "14:20", "15:40", "16:00", "16:20", "17:40", "18:00", "18:20", "19:00", "19:20"];
  const BUSY = new Set(["14:00", "16:00", "18:00"]);
  const rub = (n) => n.toLocaleString("ru-RU").replace(/ /g, " ") + " ₽";
  const band = (r) => BANDS.find((b) => r >= b.from && r <= b.to);
  const PH = '<i class="ph ph-phone" aria-hidden="true"></i>';
  const ARROW = '<i class="ph ph-arrow-right" aria-hidden="true"></i>';

  function render(root, opt = {}) {
    const radii = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const cats = [...new Set(SERVICES.map((s) => s[0]))];
    root.innerHTML = `
<div class="main-col">
  ${opt.pick === false ? "" : `
  <section class="pick reveal" aria-labelledby="pick-h">
    <h2 id="pick-h">Какой у вас радиус?</h2>
    <div class="radii" role="group" aria-label="Радиус колёс">
      ${radii.map((r) => `<button type="button" class="rad" data-r="${r}" aria-pressed="${r === 16}">R${r}</button>`).join("")}
    </div>
    <div class="quote" aria-live="polite">
      <div class="q-line"><span class="q-name">Смена колёс R16</span><span class="q-price"><small>от</small><b>1 600 ₽</b></span></div>
      <p class="q-desc">Снять, разбортировать, отбалансировать. Около 40 минут</p>
      <a class="btn primary wide" href="#book">Выбрать время<span class="btn-ic">${ARROW}</span></a>
    </div>
  </section>`}
  <div class="season reveal"><p><b>Сезон зимней резины.</b> В сезон бывают очереди. Выберите свободное время заранее, запись занимает минуту.</p></div>
  <section class="svc reveal" aria-labelledby="svc-h">
    <h2 id="svc-h">Услуги и цены</h2>
    <p class="note">Цены «от»: точную стоимость назовёт мастер</p>
    <div class="tabs" role="tablist">${cats.map((c, i) => `<button type="button" class="tab" role="tab" aria-selected="${i === 0}" data-c="${c}">${c}</button>`).join("")}</div>
    <div class="svc-list">${SERVICES.map((s) => `<a href="#book" class="svc-row" data-c="${s[0]}"${s[0] === cats[0] ? "" : " hidden"}><span><b>${s[1]}</b><small>${s[2]}</small></span><em>от ${rub(s[3])}</em></a>`).join("")}</div>
  </section>
  <section class="rev reveal" aria-labelledby="rev-h">
    <h2 id="rev-h">Отзывы</h2>
    <div class="rev-in">
      <div class="score"><b>${BIZ.rating}</b><span class="stars" aria-label="Рейтинг 4,8 из 5">★★★★★</span><span>${BIZ.reviews} отзывов</span></div>
      <div class="src"><a href="#">Яндекс Карты <span>${BIZ.ya}</span></a><a href="#">2ГИС <span>${BIZ.gis}</span></a></div>
    </div>
  </section>
  <section class="where reveal" aria-labelledby="way-h">
    <h2 id="way-h">Как добраться</h2>
    <dl>
      <div><dt>Адрес</dt><dd>${BIZ.city}, ${BIZ.address}. ${BIZ.note}</dd></div>
      <div><dt>Часы</dt><dd>${BIZ.hours.join("<br>")}</dd></div>
      <div><dt>Телефон</dt><dd><a href="#">${BIZ.phone}</a></dd></div>
    </dl>
    <div class="two"><a class="btn ghost" href="#">Маршрут</a><a class="btn ghost" href="#">Позвонить</a></div>
  </section>
</div>
<aside class="book-col">
  <section class="book reveal" id="book" aria-labelledby="book-h">
    <h2 id="book-h">Запись</h2>
    <ol class="steps"><li class="done">Услуга</li><li class="on">Время</li><li>Контакты</li></ol>
    <div class="chosen"><span><b class="ch-name">Смена колёс R13-R16</b><small class="ch-meta">от 1 600 ₽, около 40 минут</small></span><button type="button" class="link">Изменить</button></div>
    <div class="days" role="group" aria-label="День">${DAYS.map((d, i) => `<button type="button" class="day" aria-pressed="${i === 0}"><small>${d[0]}</small><b>${d[1]}</b>${d[2] ? `<i>${d[2]}</i>` : ""}</button>`).join("")}</div>
    <div class="slots" role="group" aria-label="Время">${SLOTS.map((t, i) => `<button type="button" class="slot" ${BUSY.has(t) ? "disabled" : ""} aria-pressed="${i === 4}">${t}</button>`).join("")}</div>
    <a class="btn primary wide" href="#">Дальше: 15:40, сегодня<span class="btn-ic">${ARROW}</span></a>
  </section>
</aside>
<footer class="foot">Шаров Д. А., ИНН 590412873316, оператор персональных данных.<br><a href="#">Политика обработки персональных данных</a><br><a href="#">Согласие на обработку персональных данных</a><br>Сайт работает на сервисе <a href="#">«Автослот»</a></footer>`;

    // Радиус → цена; событие для первого экрана (сканер, драйв)
    const setR = (r) => {
      const b = band(r);
      root.querySelectorAll(".rad").forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.r === r)));
      const q = root.querySelector(".quote");
      if (q) {
        q.querySelector(".q-name").textContent = `Смена колёс R${r}`;
        q.querySelector(".q-price b").textContent = rub(b.price);
        q.querySelector(".q-desc").textContent = `${b.from >= 20 ? "Внедорожники и низкий профиль" : b.from >= 17 ? "Кроссоверы и крупные седаны" : "Снять, разбортировать, отбалансировать"}. ${b.dur}`;
      }
      root.querySelector(".ch-name").textContent = b.name;
      root.querySelector(".ch-meta").textContent = `от ${rub(b.price)}, ${b.dur.toLowerCase()}`;
      window.dispatchEvent(new CustomEvent("as:radius", { detail: { r, ...b, priceText: rub(b.price) } }));
    };
    root.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.classList.contains("rad")) setR(+t.dataset.r);
      if (t.classList.contains("tab")) {
        root.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
        root.querySelectorAll(".svc-row").forEach((x) => (x.hidden = x.dataset.c !== t.dataset.c));
      }
      if (t.classList.contains("day")) root.querySelectorAll(".day").forEach((x) => x.setAttribute("aria-pressed", String(x === t)));
      if (t.classList.contains("slot")) {
        root.querySelectorAll(".slot").forEach((x) => x.setAttribute("aria-pressed", String(x === t)));
        const d = root.querySelector('.day[aria-pressed="true"]');
        root.querySelector(".book .btn").firstChild.textContent = `Дальше: ${t.textContent}, ${d.querySelector("i") ? "сегодня" : d.querySelector("b").textContent + " октября"}`;
      }
    });
    window.AS.setR = setR;
    icons();

    // Плавное появление блоков при прокрутке (без слушателя scroll)
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -8% 0px" });
      document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    } else document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
  }

  // Значки Phosphor (regular) прямо в разметке: сторонние таблицы стилей в витрине недоступны
  const ICONS = {
    phone: "M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.25.39-.5.57-.77a16,16,0,0,0,1.32-15.06l0-.12L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46ZM176,208A128.14,128.14,0,0,1,48,80,40.2,40.2,0,0,1,82.87,40a.61.61,0,0,0,0,.12l21,47L83.2,111.86a6.13,6.13,0,0,0-.57.77,16,16,0,0,0-1,15.7c9.06,18.53,27.73,37.06,46.46,46.11a16,16,0,0,0,15.75-1.14,8.44,8.44,0,0,0,.74-.56L168.89,152l47,21.05h0s.08,0,.11,0A40.21,40.21,0,0,1,176,208Z",
    "arrow-right": "M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z",
  };
  function icons() {
    document.querySelectorAll("i.ph").forEach((i) => {
      const name = [...i.classList].find((c) => c.startsWith("ph-")).slice(3);
      i.outerHTML = `<svg class="ph" viewBox="0 0 256 256" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
    });
  }

  window.AS = { BIZ, BANDS, band, rub, render, PH, ARROW, reduced: () => matchMedia("(prefers-reduced-motion: reduce)").matches };
})();
