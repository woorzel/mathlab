-- V007__problems_format_allow_markdown_tex.sql

-- usuwamy stary CHECK
ALTER TABLE problems DROP CONSTRAINT IF EXISTS problems_format_check;

-- normalizujemy stare wartości na nową wspólną
UPDATE problems
SET format = 'MARKDOWN_TEX'
WHERE format IS NULL OR format IN ('TEX', 'LATEX', 'MARKDOWN');

-- nowy CHECK z dwoma dozwolonymi formatami
ALTER TABLE problems
  ADD CONSTRAINT problems_format_check
  CHECK (format IN ('ASCIIMATH', 'MARKDOWN_TEX'));
