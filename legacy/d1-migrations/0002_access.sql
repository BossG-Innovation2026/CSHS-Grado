-- 0002_access.sql
-- Module permissions, account lifecycle, notifications, school settings

ALTER TABLE user ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE user ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

CREATE TABLE notification (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'info',
  readAt INTEGER,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX notification_user_idx ON notification(userId);

CREATE TABLE school_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  schoolId TEXT NOT NULL DEFAULT '',
  principal TEXT NOT NULL DEFAULT '',
  updatedAt INTEGER
);