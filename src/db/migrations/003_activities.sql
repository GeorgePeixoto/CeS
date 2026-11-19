CREATE TABLE categories (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE instructors (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  bio    TEXT,
  phone  TEXT,
  email  TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE activities (
  id            INTEGER PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('workshop','course','event')),
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  instructor_id INTEGER REFERENCES instructors(id),
  location      TEXT,
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  capacity      INTEGER NOT NULL CHECK (capacity > 0),
  min_age       INTEGER,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE activity_schedules (
  id          INTEGER PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL
);