CREATE TABLE attendance (
  id            INTEGER PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  session_date  TEXT NOT NULL,
  present       INTEGER NOT NULL CHECK (present IN (0,1)),
  recorded_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (enrollment_id, session_date)
);