-- В демо число постов было взято наугад и показывалось клиенту фактом «2 поста». Убираем этот факт из демо.
UPDATE "Business"
SET "facts" = (
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb)
  FROM jsonb_array_elements("facts") AS f
  WHERE NOT (COALESCE(f->>'value', '') ~* 'пост')
)
WHERE "status" = 'demo' AND jsonb_typeof("facts") = 'array';
