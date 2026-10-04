// Логотип сервиса: картинка в базе (BusinessLogo), на сайте — по адресу <сайт>/logo?v=<время загрузки>.

export const LOGO_MAX_BYTES = 700 * 1024;

/** Тип картинки по первым байтам, а не по имени файла. SVG не принимаем: в нём может быть скрипт. */
export function imageMime(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Адрес логотипа для страниц сайта: base — «» на поддомене или «/s/<slug>» по прямой ссылке. */
export const logoSrc = (base: string, logoAt: Date | null) => (logoAt ? `${base}/logo?v=${logoAt.getTime()}` : null);
