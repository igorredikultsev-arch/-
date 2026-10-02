// Применяет миграции к тестовой базе из TEST_DATABASE_URL.
import "dotenv/config";
import { execSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Задайте TEST_DATABASE_URL в .env");
execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
