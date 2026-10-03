// Часовой пояс по городу: от него зависит, какое время клиент видит на сайте.
// Неизвестный город — Пермь (основной рынок), поменять можно в карточке сервиса.
const BY_CITY: Record<string, string> = {
  москва: "Europe/Moscow", "санкт-петербург": "Europe/Moscow", петербург: "Europe/Moscow", спб: "Europe/Moscow",
  казань: "Europe/Moscow", "нижний новгород": "Europe/Moscow", воронеж: "Europe/Moscow", киров: "Europe/Moscow",
  ростов: "Europe/Moscow", "ростов-на-дону": "Europe/Moscow", краснодар: "Europe/Moscow", ярославль: "Europe/Moscow",
  самара: "Europe/Samara", ижевск: "Europe/Samara", тольятти: "Europe/Samara", ульяновск: "Europe/Ulyanovsk",
  саратов: "Europe/Saratov", волгоград: "Europe/Volgograd", астрахань: "Europe/Astrakhan",
  пермь: "Asia/Yekaterinburg", екатеринбург: "Asia/Yekaterinburg", челябинск: "Asia/Yekaterinburg", уфа: "Asia/Yekaterinburg",
  тюмень: "Asia/Yekaterinburg", оренбург: "Asia/Yekaterinburg", курган: "Asia/Yekaterinburg", березники: "Asia/Yekaterinburg",
  соликамск: "Asia/Yekaterinburg", краснокамск: "Asia/Yekaterinburg", чайковский: "Asia/Yekaterinburg", кунгур: "Asia/Yekaterinburg",
  омск: "Asia/Omsk", новосибирск: "Asia/Novosibirsk", барнаул: "Asia/Barnaul", томск: "Asia/Tomsk", кемерово: "Asia/Novokuznetsk",
  новокузнецк: "Asia/Novokuznetsk", красноярск: "Asia/Krasnoyarsk", иркутск: "Asia/Irkutsk", чита: "Asia/Chita",
  якутск: "Asia/Yakutsk", владивосток: "Asia/Vladivostok", хабаровск: "Asia/Vladivostok", калининград: "Europe/Kaliningrad",
};

export const DEFAULT_TZ = "Asia/Yekaterinburg";

export function timezoneForCity(city: string): string {
  const key = city.toLowerCase().replace(/ё/g, "е").replace(/^г\.?\s*/, "").trim();
  return BY_CITY[key] ?? DEFAULT_TZ;
}
