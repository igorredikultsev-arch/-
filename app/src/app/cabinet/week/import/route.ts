// Перенос из Google Календаря: архив экспорта или файлы .ics. Отдельный адрес, а не действие формы:
// у действий предел 1 МБ, а архив календаря за несколько лет бывает больше.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { audit, requireOwner } from "@/lib/auth";
import { importCalendars, readCalendars } from "@/lib/calendar-import";

const MAX = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const { user, business } = await requireOwner();
  // Запрос только со страницы кабинета: чужой сайт не отправит файл от имени владельца
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Запрос не с этого сайта" }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX) return NextResponse.json({ error: "Файл больше 20 МБ" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Выберите архив .zip или файлы .ics" }, { status: 400 });
  try {
    const calendars = readCalendars(await Promise.all(files.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }))), business.timezone);
    if (!calendars.length) return NextResponse.json({ error: "В файле нет календарей. Нужен архив из Google Календаря: Настройки → Импорт и экспорт → Экспорт" }, { status: 400 });
    const result = await importCalendars(business, calendars);
    await audit("calendar.import", { userId: user.id, businessId: business.id, details: { calendars: result.calendars.length } });
    revalidatePath("/cabinet", "layout");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error && /zip|Архив/.test(e.message) ? e.message : "Не получилось прочитать файл. Нужен архив из Google Календаря" }, { status: 400 });
  }
}
