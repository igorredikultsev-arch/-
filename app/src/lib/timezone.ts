// Часовой пояс по городу: от него зависит, какое время клиент видит на сайте.
// Неизвестный город — Пермь (основной рынок), поменять можно в карточке сервиса.
const BY_CITY: Record<string, string> = {
  москва: "Europe/Moscow", "санкт-петербург": "Europe/Moscow", петербург: "Europe/Moscow", спб: "Europe/Moscow",
  казань: "Europe/Moscow", тула: "Europe/Moscow", тверь: "Europe/Moscow", пенза: "Europe/Moscow", рязань: "Europe/Moscow",
  "набережные челны": "Europe/Moscow", чебоксары: "Europe/Moscow", архангельск: "Europe/Moscow", вологда: "Europe/Moscow",
  иваново: "Europe/Moscow", калуга: "Europe/Moscow", брянск: "Europe/Moscow", белгород: "Europe/Moscow", курск: "Europe/Moscow",
  липецк: "Europe/Moscow", тамбов: "Europe/Moscow", смоленск: "Europe/Moscow", владимир: "Europe/Moscow", кострома: "Europe/Moscow",
  "йошкар-ола": "Europe/Moscow", саранск: "Europe/Moscow", сыктывкар: "Europe/Moscow", мурманск: "Europe/Moscow", петрозаводск: "Europe/Moscow",
  "великий новгород": "Europe/Moscow", псков: "Europe/Moscow", ставрополь: "Europe/Moscow", сочи: "Europe/Moscow", махачкала: "Europe/Moscow",
  "улан-удэ": "Asia/Irkutsk", "нижний тагил": "Asia/Yekaterinburg", магнитогорск: "Asia/Yekaterinburg", сургут: "Asia/Yekaterinburg",
  "ханты-мансийск": "Asia/Yekaterinburg", стерлитамак: "Asia/Yekaterinburg", "нижний новгород": "Europe/Moscow", воронеж: "Europe/Moscow", киров: "Europe/Moscow",
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

/** Пояса России для выбора в админке, когда города нет в списке выше. */
export const ZONES: { value: string; label: string }[] = [
  { value: "Europe/Kaliningrad", label: "Калининград, МСК−1" },
  { value: "Europe/Moscow", label: "Москва, МСК" },
  { value: "Europe/Samara", label: "Самара, Ижевск, МСК+1" },
  { value: "Asia/Yekaterinburg", label: "Пермь, Екатеринбург, МСК+2" },
  { value: "Asia/Omsk", label: "Омск, МСК+3" },
  { value: "Asia/Novosibirsk", label: "Новосибирск, МСК+4" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск, Кемерово, МСК+4" },
  { value: "Asia/Irkutsk", label: "Иркутск, Улан-Удэ, МСК+5" },
  { value: "Asia/Yakutsk", label: "Якутск, Чита, МСК+6" },
  { value: "Asia/Vladivostok", label: "Владивосток, Хабаровск, МСК+7" },
  { value: "Asia/Magadan", label: "Магадан, МСК+8" },
  { value: "Asia/Kamchatka", label: "Камчатка, МСК+9" },
];

/** Город есть в списке — пояс определён точно; иначе стоит пермский, и его стоит проверить. */
export function isKnownCity(city: string): boolean {
  return city.toLowerCase().replace(/ё/g, "е").replace(/^г\.?\s*/, "").trim() in BY_CITY;
}

export function timezoneForCity(city: string): string {
  const key = city.toLowerCase().replace(/ё/g, "е").replace(/^г\.?\s*/, "").trim();
  return BY_CITY[key] ?? DEFAULT_TZ;
}
