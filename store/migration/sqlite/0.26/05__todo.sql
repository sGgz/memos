-- todo
CREATE TABLE todo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_time BIGINT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'LOW',
  status TEXT NOT NULL DEFAULT 'NORMAL',
  payload TEXT NOT NULL DEFAULT '{}'
);
