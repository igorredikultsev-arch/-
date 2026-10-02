// Создать или обновить администратора: npm run admin:create -- +79991234567 "надёжный-пароль"
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { db } from "../src/lib/db";
import { normalizePhone } from "../src/lib/phone";

async function main() {
  const [rawPhone, password] = process.argv.slice(2);
  const phone = normalizePhone(rawPhone ?? "");
  if (!phone || !password || password.length < 10) {
    console.error('Использование: npm run admin:create -- +79991234567 "пароль от 10 символов"');
    process.exit(1);
  }
  const passwordHash = await hash(password);
  await db.user.upsert({
    where: { phone },
    update: { passwordHash, role: "admin" },
    create: { phone, passwordHash, role: "admin", name: "Администратор" },
  });
  console.log(`Администратор ${phone} готов`);
}

main().finally(() => db.$disconnect());
