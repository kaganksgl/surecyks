const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;

const db = new DatabaseSync(path.join(__dirname, 'database', 'app.db'));
db.exec(fs.readFileSync(path.join(__dirname, 'database', 'database.sql'), 'utf8'));

// Every distinct mock-exam subject key across every exam type/field — must
// stay in sync with ALL_SUBJECT_KEYS in js/main.js (client owns the labels/
// colors/question counts; the server only needs the column names).
const SUBJECT_KEYS = [
    'tyt_turkce', 'tyt_sosyal', 'tyt_matematik', 'tyt_fen',
    'ayt_matematik', 'ayt_fizik', 'ayt_kimya', 'ayt_biyoloji',
    'ayt_edebiyat', 'ayt_sosyal2',
    'ydt',
];

// Seed data for a brand-new account's task list — mirrors DEFAULT_TASKS in
// js/main.js, the old localStorage-only fallback for a first-ever visit.
const DEFAULT_TASKS = [
    { ders: 'Matematik', konu: 'Türev Tekrarı',     soruSayisi: 40, color: '#2563eb', done: true },
    { ders: 'Biyoloji',  konu: 'Hücre Bölünmesi',   soruSayisi: 25, color: '#16a34a', done: false },
    { ders: 'Türkçe',    konu: 'Paragraf Soruları', soruSayisi: 20, color: '#fbbf24', done: false },
    { ders: 'Fizik',     konu: 'Deneme Analizi',    soruSayisi: 1,  color: '#7dd3fc', done: false },
];

const STREAK_MILESTONES = [3, 7, 15, 30, 50, 100, 200, 365];

// ALTER TABLE isn't idempotent like CREATE TABLE IF NOT EXISTS, so existing
// databases need a guarded column add instead of a plain statement in
// database.sql (which re-runs on every server start).
function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
    if (!columns.includes(column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}
ensureColumn('users', 'tasks_seeded', 'INTEGER NOT NULL DEFAULT 0');

// denemeler has one nullable dogru/yanlis column pair per subject key, which
// is impractical to hand-write in database.sql, so it's built here instead.
const subjectColumnsSql = SUBJECT_KEYS
    .flatMap(key => [`${key}_dogru INTEGER NOT NULL DEFAULT 0`, `${key}_yanlis INTEGER NOT NULL DEFAULT 0`])
    .join(',\n        ');
db.exec(`
    CREATE TABLE IF NOT EXISTS denemeler (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        tarih       TEXT NOT NULL,
        sinav_turu  TEXT NOT NULL,
        alan        TEXT,
        ${subjectColumnsSql},
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
`);

const app = express();

app.use(express.json());
const REMEMBER_ME_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    // No maxAge by default — a plain session cookie that expires when the
    // browser closes. "Beni hatırla" on the login form opts into a
    // persistent 30-day cookie instead (see /api/login).
    cookie: { httpOnly: true },
}));

app.use('/project', express.static(path.join(__dirname, 'project')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.get('/', (req, res) => res.redirect('/project/index.html'));

function publicUser(row) {
    return { firstName: row.first_name, lastName: row.last_name, email: row.email, createdAt: row.created_at };
}

app.post('/api/signup', (req, res) => {
    const { firstName, lastName, email, password, confPassword } = req.body || {};

    if (!firstName || !lastName || !email || !password || !confPassword) {
        return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
    }
    if (password !== confPassword) {
        return res.status(400).json({ error: 'Şifreler eşleşmiyor.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
        return res.status(409).json({ error: 'Bu email zaten kayıtlı.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const trimmedFirst = String(firstName).trim();
    const trimmedLast = String(lastName).trim();

    const info = db.prepare(
        'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)'
    ).run(trimmedFirst, trimmedLast, normalizedEmail, passwordHash);

    req.session.userId = Number(info.lastInsertRowid);
    res.status(201).json({ user: { firstName: trimmedFirst, lastName: trimmedLast, email: normalizedEmail } });
});

app.post('/api/login', (req, res) => {
    const { email, password, remember } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email ve şifre zorunludur.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Email veya şifre hatalı.' });
    }

    if (remember) {
        req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE;
    }

    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }
    res.json({ user: publicUser(user) });
});

app.put('/api/profile', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const { firstName, lastName } = req.body || {};
    if (!firstName || !lastName) {
        return res.status(400).json({ error: 'Ad ve soyad zorunludur.' });
    }

    const trimmedFirst = String(firstName).trim();
    const trimmedLast = String(lastName).trim();
    if (!trimmedFirst || !trimmedLast) {
        return res.status(400).json({ error: 'Ad ve soyad zorunludur.' });
    }

    db.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?')
        .run(trimmedFirst, trimmedLast, req.session.userId);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    res.json({ user: publicUser(user) });
});

app.post('/api/change-password', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body || {};
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
    }
    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ error: 'Yeni şifreler eşleşmiyor.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

    res.json({ ok: true });
});

/* ================================================================
   Today's plan (tasks)
   ================================================================ */

function publicTask(row) {
    return {
        id: row.id,
        ders: row.ders,
        konu: row.konu,
        soruSayisi: row.soru_sayisi,
        color: row.color,
        done: !!row.done,
    };
}

function getOrSeedTasks(userId) {
    let rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY id ASC').all(userId);
    const user = db.prepare('SELECT tasks_seeded FROM users WHERE id = ?').get(userId);

    if (rows.length === 0 && user && !user.tasks_seeded) {
        const insert = db.prepare(
            'INSERT INTO tasks (user_id, ders, konu, soru_sayisi, color, done) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const task of DEFAULT_TASKS) {
            insert.run(userId, task.ders, task.konu, task.soruSayisi, task.color, task.done ? 1 : 0);
        }
        db.prepare('UPDATE users SET tasks_seeded = 1 WHERE id = ?').run(userId);
        rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY id ASC').all(userId);
    }

    return rows;
}

app.get('/api/tasks', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }
    res.json(getOrSeedTasks(req.session.userId).map(publicTask));
});

app.post('/api/tasks', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const { ders, konu, soruSayisi, color } = req.body || {};
    const parsedSoruSayisi = Math.round(Number(soruSayisi));
    if (!ders || !konu || !Number.isFinite(parsedSoruSayisi) || parsedSoruSayisi < 1) {
        return res.status(400).json({ error: 'Geçersiz görev bilgisi.' });
    }

    const info = db.prepare(
        'INSERT INTO tasks (user_id, ders, konu, soru_sayisi, color, done) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(req.session.userId, String(ders).trim(), String(konu).trim(), parsedSoruSayisi, String(color || '#2563eb'));
    db.prepare('UPDATE users SET tasks_seeded = 1 WHERE id = ?').run(req.session.userId);

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json(publicTask(row));
});

app.patch('/api/tasks/:id', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const id = Number(req.params.id);
    const { done } = req.body || {};
    const result = db.prepare('UPDATE tasks SET done = ? WHERE id = ? AND user_id = ?')
        .run(done ? 1 : 0, id, req.session.userId);

    if (result.changes === 0) {
        return res.status(404).json({ error: 'Görev bulunamadı.' });
    }
    res.json({ ok: true });
});

app.delete('/api/tasks/:id', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, req.session.userId);

    if (result.changes === 0) {
        return res.status(404).json({ error: 'Görev bulunamadı.' });
    }
    res.json({ ok: true });
});

/* ================================================================
   Mock exam results (denemeler)
   ================================================================ */

function publicDeneme(row) {
    const out = { id: row.id, tarih: row.tarih, sinav_turu: row.sinav_turu, alan: row.alan };
    SUBJECT_KEYS.forEach(key => {
        out[`${key}_dogru`] = row[`${key}_dogru`];
        out[`${key}_yanlis`] = row[`${key}_yanlis`];
    });
    return out;
}

app.get('/api/denemeler', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }
    const rows = db.prepare('SELECT * FROM denemeler WHERE user_id = ? ORDER BY id DESC').all(req.session.userId);
    res.json(rows.map(publicDeneme));
});

app.post('/api/denemeler', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const body = req.body || {};
    const { tarih, sinav_turu: sinavTuru, alan } = body;

    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(String(tarih || ''))) {
        return res.status(400).json({ error: 'Geçersiz tarih.' });
    }
    if (!['TYT', 'AYT', 'YDT'].includes(sinavTuru)) {
        return res.status(400).json({ error: 'Geçersiz sınav türü.' });
    }
    if (sinavTuru === 'AYT' && !['sayisal', 'ea', 'sozel'].includes(alan)) {
        return res.status(400).json({ error: 'AYT için alan zorunludur.' });
    }

    const columns = ['user_id', 'tarih', 'sinav_turu', 'alan', ...SUBJECT_KEYS.flatMap(key => [`${key}_dogru`, `${key}_yanlis`])];
    const placeholders = columns.map(() => '?').join(', ');
    const values = [
        req.session.userId, tarih, sinavTuru, sinavTuru === 'AYT' ? alan : null,
        ...SUBJECT_KEYS.flatMap(key => [parseInt(body[`${key}_dogru`], 10) || 0, parseInt(body[`${key}_yanlis`], 10) || 0]),
    ];

    const info = db.prepare(`INSERT INTO denemeler (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
    const row = db.prepare('SELECT * FROM denemeler WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json(publicDeneme(row));
});

app.delete('/api/denemeler/:id', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM denemeler WHERE id = ? AND user_id = ?').run(id, req.session.userId);

    if (result.changes === 0) {
        return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }
    res.json({ ok: true });
});

/* ================================================================
   Daily streak (with milestone tracking)
   ================================================================ */

function addDaysToDateStr(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + delta);
    const pad = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

app.get('/api/streak', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const today = String(req.query.today || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
        return res.status(400).json({ error: 'Geçersiz tarih.' });
    }

    const userId = req.session.userId;
    let row = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);

    if (!row) {
        db.prepare(
            'INSERT INTO streaks (user_id, current_count, best_count, last_date, milestone_seen) VALUES (?, 1, 1, ?, 0)'
        ).run(userId, today);
        row = { current_count: 1, best_count: 1, last_date: today, milestone_seen: 0 };
    } else if (row.last_date !== today) {
        const yesterday = addDaysToDateStr(today, -1);
        const nextCount = row.last_date === yesterday ? row.current_count + 1 : 1;
        const nextBest = Math.max(row.best_count, nextCount);
        db.prepare('UPDATE streaks SET current_count = ?, best_count = ?, last_date = ? WHERE user_id = ?')
            .run(nextCount, nextBest, today, userId);
        row = { ...row, current_count: nextCount, best_count: nextBest, last_date: today };
    }

    let newMilestone = null;
    if (STREAK_MILESTONES.includes(row.current_count) && row.current_count > row.milestone_seen) {
        newMilestone = row.current_count;
        db.prepare('UPDATE streaks SET milestone_seen = ? WHERE user_id = ?').run(row.current_count, userId);
    }

    res.json({ count: row.current_count, best: row.best_count, newMilestone });
});

/* ================================================================
   One-time import of pre-existing localStorage data
   ================================================================ */

app.post('/api/migrate-legacy', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum yok.' });
    }

    const userId = req.session.userId;
    const { tasks, denemeler } = req.body || {};

    let importedTasks = 0;
    let importedDenemeler = 0;

    const existingTaskCount = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE user_id = ?').get(userId).c;
    if (existingTaskCount === 0 && Array.isArray(tasks) && tasks.length) {
        const insert = db.prepare(
            'INSERT INTO tasks (user_id, ders, konu, soru_sayisi, color, done) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const task of tasks) {
            if (!task || !task.ders || !task.konu) continue;
            insert.run(
                userId, String(task.ders), String(task.konu),
                parseInt(task.soruSayisi, 10) || 0, String(task.color || '#2563eb'), task.done ? 1 : 0
            );
            importedTasks++;
        }
        if (importedTasks > 0) {
            db.prepare('UPDATE users SET tasks_seeded = 1 WHERE id = ?').run(userId);
        }
    }

    const existingDenemeCount = db.prepare('SELECT COUNT(*) AS c FROM denemeler WHERE user_id = ?').get(userId).c;
    if (existingDenemeCount === 0 && Array.isArray(denemeler) && denemeler.length) {
        const columns = ['user_id', 'tarih', 'sinav_turu', 'alan', ...SUBJECT_KEYS.flatMap(key => [`${key}_dogru`, `${key}_yanlis`])];
        const placeholders = columns.map(() => '?').join(', ');
        const insert = db.prepare(`INSERT INTO denemeler (${columns.join(', ')}) VALUES (${placeholders})`);
        for (const row of denemeler) {
            if (!row || !row.tarih || !row.sinav_turu) continue;
            insert.run(
                userId, String(row.tarih), String(row.sinav_turu), row.alan ? String(row.alan) : null,
                ...SUBJECT_KEYS.flatMap(key => [parseInt(row[`${key}_dogru`], 10) || 0, parseInt(row[`${key}_yanlis`], 10) || 0])
            );
            importedDenemeler++;
        }
    }

    res.json({ importedTasks, importedDenemeler });
});

app.listen(PORT, () => console.log(`Süreç YKS server running at http://localhost:${PORT}`));
