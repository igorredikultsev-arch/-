-- Этап «Спросили, ждём ответа»: первое сообщение — вопрос, демо после ответа «да» (ст. 15 152-ФЗ)
ALTER TYPE "LeadStatus" ADD VALUE 'asked' BEFORE 'demo_sent';
