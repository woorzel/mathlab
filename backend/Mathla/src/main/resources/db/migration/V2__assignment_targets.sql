-- Zadania przydzielone konkretnym uczniom
CREATE TABLE assignment_students (
  id            BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    BIGINT NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_assignment_students_student ON assignment_students(student_id);
CREATE INDEX idx_assignment_students_assign  ON assignment_students(assignment_id);
