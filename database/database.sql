CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    ders        TEXT NOT NULL,
    konu        TEXT NOT NULL,
    soru_sayisi INTEGER NOT NULL DEFAULT 0,
    color       TEXT NOT NULL,
    done        INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS streaks (
    user_id        INTEGER PRIMARY KEY,
    current_count  INTEGER NOT NULL DEFAULT 0,
    best_count     INTEGER NOT NULL DEFAULT 0,
    last_date      TEXT,
    milestone_seen INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
