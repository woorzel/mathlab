-- 1) Docelowa kolumna na treść problemu (używana przez aplikację)
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS content text;

-- 2) Przenieś stare dane z content_md (jeśli były używane wcześniej)
UPDATE problems
SET content = content_md
WHERE content IS NULL AND content_md IS NOT NULL;

-- 3) Upewnij się, że stara kolumna nie blokuje zapisu (zdejmiemy NOT NULL, jeżeli istnieje)
DO $$
BEGIN
  IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='problems' AND column_name='content_md'
  ) THEN
    EXECUTE 'ALTER TABLE problems ALTER COLUMN content_md DROP NOT NULL';
  END IF;
END$$;

-- (opcjonalnie) po zweryfikowaniu danych możesz całkiem usunąć starą kolumnę:
-- ALTER TABLE problems DROP COLUMN IF EXISTS content_md;

-- 4) Kolumna z formatem (enum trzymamy jako tekst po stronie DB)
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS format varchar(24);

-- 5) Dla starych rekordów ustaw jakikolwiek poprawny format,
--    żeby uniknąć NPE w Javie. 'ASCIIMATH' na pewno masz (pojawił się w logach).
UPDATE problems
SET format = 'ASCIIMATH'
WHERE format IS NULL;

-- 6) (opcjonalnie) jeśli chcesz wymusić obecność treści/formatu w nowych rekordach:
-- ALTER TABLE problems ALTER COLUMN content SET NOT NULL;
-- ALTER TABLE problems ALTER COLUMN format  SET NOT NULL;
