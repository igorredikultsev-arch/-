import { inflateRawSync } from "node:zlib";

// Чтение таблиц для импорта: .xlsx (Excel, Google Таблицы) и .csv. Без сторонних библиотек:
// xlsx — это zip с XML внутри, нам нужны только значения ячеек.

export type Sheet = { name: string; rows: string[][] };

const MAX_UNZIPPED = 20 * 1024 * 1024; // одна часть файла
const MAX_TOTAL = 40 * 1024 * 1024; // все распакованные части вместе: сервер с 1 ГБ памяти
const MAX_ENTRIES = 500;
// Нужны только книга, общие строки и листы; картинки, стили и прочее не распаковываем
const NEEDED = /^xl\/(workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/;

function unzip(buf: Buffer): Map<string, Buffer> {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Файл повреждён или это не .xlsx");
  const count = buf.readUInt16LE(end + 10);
  if (count > MAX_ENTRIES) throw new Error("Файл .xlsx слишком сложный: оставьте в нём только лист с сервисами");
  let p = buf.readUInt32LE(end + 16);
  const out = new Map<string, Buffer>();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const skip = nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    p += 46 + skip;
    if (!NEEDED.test(name)) continue;
    const data = buf.subarray(start, start + size);
    const file = method === 0 ? data : method === 8 ? inflateRawSync(data, { maxOutputLength: MAX_UNZIPPED }) : null;
    if (!file) continue;
    total += file.length;
    if (total > MAX_TOTAL) throw new Error("Файл .xlsx слишком большой после распаковки: оставьте в нём только лист с сервисами");
    out.set(name, file);
  }
  return out;
}

const decodeXml = (s: string) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    if (k === "amp") return "&";
    return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });

/** Текст из <t> внутри узла: у строк с форматированием он разбит на несколько кусков. */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

function sheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rNum = /\br="(\d+)"/.exec(rm[1]);
    const row: string[] = [];
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val = "";
      if (type === "s") val = v != null ? shared[+v] ?? "" : "";
      else if (type === "inlineStr") val = texts(body);
      else if (type === "b") val = v === "1" ? "да" : "";
      else if (v != null) val = decodeXml(v);
      row[ref ? colIndex(ref) : row.length] = val;
    }
    const at = rNum ? +rNum[1] - 1 : rows.length;
    rows[at] = Array.from(row, (x) => x ?? "");
  }
  return Array.from(rows, (r) => r ?? []);
}

export function readXlsx(buf: Buffer): Sheet[] {
  const files = unzip(buf);
  const get = (n: string) => files.get(n)?.toString("utf8") ?? "";
  const shared = [...get("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const wb = get("xl/workbook.xml");
  const rels = new Map([...get("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]+)"/.exec(m[0])?.[1], /Target="([^"]+)"/.exec(m[0])?.[1]]));
  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(/name="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const target = rels.get(/r:id="([^"]+)"/.exec(m[0])?.[1]);
    if (!target) continue;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    sheets.push({ name, rows: sheetRows(get(path), shared) });
  }
  return sheets;
}

/** CSV из Excel (точка с запятой, часто в кодировке Windows-1251), Google Таблиц (запятая) или с табуляцией. */
export function readCsv(buf: Buffer): Sheet[] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1251").decode(buf);
  }
  text = text.replace(/^﻿/, "");
  const first = text.slice(0, text.indexOf("\n") >>> 0);
  const sep = [";", "\t", ","].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) rows.push([...row, cell]);
  return [{ name: "CSV", rows }];
}

export function readTable(buf: Buffer, fileName: string): Sheet[] {
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (isZip) return readXlsx(buf);
  if (/\.xlsx?$/i.test(fileName)) throw new Error("Старый формат .xls не поддерживается. Сохраните таблицу как .xlsx или .csv");
  return readCsv(buf);
}
