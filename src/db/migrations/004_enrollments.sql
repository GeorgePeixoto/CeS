CREATE TABLE participants (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT,
  birth_date     TEXT NOT NULL,
  guardian_name  TEXT,
  guardian_phone TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_participants_phone ON participants(phone);

CREATE TABLE enrollments (
  id             INTEGER PRIMARY KEY,
  activity_id    INTEGER NOT NULL REFERENCES activities(id),
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  protocol       TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  consent_at     TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_active_enrollment
  ON enrollments(activity_id, participant_id) WHERE status <> 'cancelled';