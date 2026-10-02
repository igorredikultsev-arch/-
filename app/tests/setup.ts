import "dotenv/config";

// Интеграционные тесты работают с отдельной базой, чтобы не трогать данные разработки
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
