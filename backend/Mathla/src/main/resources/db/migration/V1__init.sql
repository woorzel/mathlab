CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('STUDENT','TEACHER','ADMIN');
CREATE TYPE formula_input AS ENUM ('ASCIIMATH','TEX');

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'STUDENT',
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignments (
  id          BIGSERIAL PRIMARY KEY,
  teacher_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_teacher ON assignments(teacher_id);

CREATE TABLE problems (
  id            BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  author_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  content_md    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE submissions (
  id            BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_answer   TEXT,
  grade         NUMERIC(4,2),
  feedback      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE formulas (
  id            BIGSERIAL PRIMARY KEY,
  problem_id    BIGINT REFERENCES problems(id) ON DELETE CASCADE,
  submission_id BIGINT REFERENCES submissions(id) ON DELETE CASCADE,
  raw_input     TEXT NOT NULL,
  input_type    formula_input NOT NULL,
  mathml        TEXT NOT NULL,
  speech_text   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  payload_json JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
