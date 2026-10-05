// Часовой пояс по городу: от него зависит, какое время клиент видит на сайте.
// Неизвестный город — Пермь (основной рынок), поменять можно в карточке сервиса.
// Каждый пояс здесь должен быть в списке ZONES: иначе выпадающий список в админке покажет первый пункт (Калининград)
// и сохранение карточки молча сменит пояс. Города с собственным поясом (Саратов, Барнаул…) записаны поясом из списка с тем же временем.
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
  самара: "Europe/Samara", ижевск: "Europe/Samara", тольятти: "Europe/Samara", ульяновск: "Europe/Samara",
  саратов: "Europe/Samara", волгоград: "Europe/Moscow", астрахань: "Europe/Samara",
  пермь: "Asia/Yekaterinburg", екатеринбург: "Asia/Yekaterinburg", челябинск: "Asia/Yekaterinburg", уфа: "Asia/Yekaterinburg",
  тюмень: "Asia/Yekaterinburg", оренбург: "Asia/Yekaterinburg", курган: "Asia/Yekaterinburg", березники: "Asia/Yekaterinburg",
  соликамск: "Asia/Yekaterinburg", краснокамск: "Asia/Yekaterinburg", чайковский: "Asia/Yekaterinburg", кунгур: "Asia/Yekaterinburg",
  омск: "Asia/Omsk", новосибирск: "Asia/Novosibirsk", барнаул: "Asia/Novosibirsk", томск: "Asia/Novosibirsk", кемерово: "Asia/Krasnoyarsk",
  новокузнецк: "Asia/Krasnoyarsk", красноярск: "Asia/Krasnoyarsk", иркутск: "Asia/Irkutsk", чита: "Asia/Yakutsk",
  якутск: "Asia/Yakutsk", владивосток: "Asia/Vladivostok", хабаровск: "Asia/Vladivostok", калининград: "Europe/Kaliningrad",
};

export const DEFAULT_TZ = "Asia/Yekaterinburg";

/** Пояса России для выбора в админке, когда города нет в списке выше. */
export const ZONES: { value: string; label: string }[] = [
  { value: "Europe/Kaliningrad", label: "Калининград, МСК−1" },
  { value: "Europe/Moscow", label: "Москва, МСК" },
  { value: "Europe/Samara", label: "Самара, Ижевск, Саратов, Ульяновск, Астрахань, МСК+1" },
  { value: "Asia/Yekaterinburg", label: "Пермь, Екатеринбург, МСК+2" },
  { value: "Asia/Omsk", label: "Омск, МСК+3" },
  { value: "Asia/Novosibirsk", label: "Новосибирск, Барнаул, Томск, МСК+4" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск, Кемерово, Новокузнецк, МСК+4" },
  { value: "Asia/Irkutsk", label: "Иркутск, Улан-Удэ, МСК+5" },
  { value: "Asia/Yakutsk", label: "Якутск, Чита, МСК+6" },
  { value: "Asia/Vladivostok", label: "Владивосток, Хабаровск, МСК+7" },
  { value: "Asia/Magadan", label: "Магадан, МСК+8" },
  { value: "Asia/Kamchatka", label: "Камчатка, МСК+9" },
];

/** Пояса, которые раньше ставились по городу (до списка ZONES). У сервисов, созданных тогда, остаются в базе, их тоже принимаем. */
const LEGACY_ZONES = ["Europe/Ulyanovsk", "Europe/Saratov", "Europe/Volgograd", "Europe/Astrakhan", "Asia/Barnaul", "Asia/Tomsk", "Asia/Novokuznetsk", "Asia/Chita"];

/** Пояс можно сохранить из карточки: из списка или старый, который уже стоит у сервиса. */
export const isAllowedZone = (v: string) => ZONES.some((z) => z.value === v) || LEGACY_ZONES.includes(v);

/** Город есть в списке — пояс определён точно; иначе стоит пермский, и его стоит проверить. */
export function isKnownCity(city: string): boolean {
  return city.toLowerCase().replace(/ё/g, "е").replace(/^г\.?\s*/, "").trim() in BY_CITY;
}

export function timezoneForCity(city: string): string {
  const key = city.toLowerCase().replace(/ё/g, "е").replace(/^г\.?\s*/, "").trim();
  return BY_CITY[key] ?? DEFAULT_TZ;
}
