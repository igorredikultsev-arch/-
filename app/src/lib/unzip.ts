// Чтение .zip без библиотек: архив экспорта Google Календаря (по файлу .ics на календарь).
import { inflateRawSync } from "node:zlib";

/** Файлы архива: имя и содержимое. Папки и неподдерживаемое сжатие пропускаются. */
export function unzip(buf: Buffer, maxTotal = 50 * 1024 * 1024): { name: string; data: Buffer }[] {
  // Конец центрального каталога: подпись 0x06054b50 в последних 64 КБ (после неё может быть комментарий)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Это не архив .zip");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: { name: string; data: Buffer }[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Архив повреждён");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
    p += 46 + nlen + elen + clen;
    if (name.endsWith("/") || (method !== 0 && method !== 8)) continue;
    total += usize;
    if (total > maxTotal) throw new Error("Архив слишком большой");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    out.push({ name, data: method === 0 ? Buffer.from(raw) : inflateRawSync(raw) });
  }
  return out;
}
