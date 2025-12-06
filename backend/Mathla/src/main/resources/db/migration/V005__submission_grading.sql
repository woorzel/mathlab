ALTER TABLE submissions ADD COLUMN IF NOT EXISTS score numeric(5,2);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS status varchar(16);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS review_note varchar(1000);
UPDATE submissions SET status='DRAFT' WHERE status IS NULL;
