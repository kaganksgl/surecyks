// main.js — Süreç YKS dashboard interactions

/* ================================================================
   Constants
   ================================================================ */

const PLAN_STORAGE_KEY  = 'surecYksTodayPlan';
const DB_STORAGE_KEY    = 'surecYksDenemesDB';

const SUBJECTS = [
    { key: 'mat', label: 'Matematik',       color: '#2563eb', maxQ: 40 },
    { key: 'fen', label: 'Fen Bilimleri',   color: '#16a34a', maxQ: 20 },
    { key: 'sos', label: 'Sosyal Bilimler', color: '#f59e0b', maxQ: 20 },
    { key: 'trk', label: 'Türkçe',          color: '#7c3aed', maxQ: 40 },
];

// Seed data for tasks — used only on first ever load.
const DEFAULT_TASKS = [
    { id: 't1', ders: 'Matematik', konu: 'Türev Tekrarı',    soruSayisi: 40, color: '#2563eb', done: true  },
    { id: 't2', ders: 'Biyoloji',  konu: 'Hücre Bölünmesi', soruSayisi: 25, color: '#16a34a', done: false },
    { id: 't3', ders: 'Türkçe',    konu: 'Paragraf Soruları',soruSayisi: 20, color: '#fbbf24', done: false },
    { id: 't4', ders: 'Fizik',     konu: 'Deneme Analizi',   soruSayisi:  1, color: '#7dd3fc', done: false },
];

/* ================================================================
   Bootstrap
   ================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
    initCountdown();
    initUserMenu();
    initPlanChecklist();
    initQuickAccess();
    initDailyQuote();

    // sql.js loads asynchronously via the CDN <script> tag.
    // initSqlJs() is the global entry-point it exposes.
    try {
        const SQL = await initSqlJs({
            locateFile: file =>
                `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });
        const db = loadOrCreateDb(SQL);
        renderLatestDeneme(db);
        initDenemeForms(db);
    } catch (err) {
        console.error('sql.js yüklenemedi:', err);
    }
});

/* ================================================================
   1. YKS countdown
   ================================================================ */

function initCountdown() {
    const el = document.getElementById('countdownNumber');
    if (!el) return;

    const examDate = new Date(2027, 5, 19); // 19 Haziran 2027 (month is 0-indexed)
    const today    = new Date();
    today.setHours(0, 0, 0, 0);

    const days = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
    el.textContent = days > 0 ? days : '0';
}

/* ================================================================
   2. Today's plan (tasks)
   ================================================================ */

function loadTasks() {
    try {
        const raw = localStorage.getItem(PLAN_STORAGE_KEY);
        if (!raw) return DEFAULT_TASKS.slice();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : DEFAULT_TASKS.slice();
    } catch { return DEFAULT_TASKS.slice(); }
}

function saveTasks(tasks) {
    try { localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(tasks)); }
    catch { /* quota / private mode — fail silently */ }
}

function escapeHtml(value) {
    const d = document.createElement('div');
    d.textContent = String(value);
    return d.innerHTML;
}

function updateHeroText(tasks) {
    const el = document.getElementById('heroTaskText');
    if (!el) return;

    const remaining = tasks.filter(t => !t.done).length;

    if (tasks.length === 0) {
        el.textContent = 'Bugün için henüz görev eklenmedi. Hadi ekleyelim!';
    } else if (remaining === 0) {
        el.textContent = 'Bugünün tüm görevlerini tamamladın. Harika iş!';
    } else if (remaining === 1) {
        el.textContent = 'Bugün 1 görev seni bekliyor. Hadi başlayalım.';
    } else {
        el.textContent = `Bugün ${remaining} görev seni bekliyor. Hadi başlayalım.`;
    }
}

function renderTasks(tasks, listEl) {
    updateHeroText(tasks);

    if (tasks.length === 0) {
        listEl.innerHTML = '<li class="plan-empty">Bugün için henüz görev eklenmedi.</li>';
        return;
    }
    listEl.innerHTML = tasks.map(task => `
        <li class="plan-item${task.done ? ' done' : ''}" data-task-id="${escapeHtml(task.id)}">
            <span class="plan-subject" style="background-color:${escapeHtml(task.color)};"></span>
            <button type="button" class="plan-check"
                    aria-pressed="${task.done}"
                    aria-label="Görevi tamamlandı olarak işaretle">${task.done ? '✓' : ''}</button>
            <div class="plan-body">
                <div class="plan-title">${escapeHtml(task.ders)} &middot; ${escapeHtml(task.konu)}</div>
                <div class="plan-meta">${task.done ? 'tamamlandı' : `${escapeHtml(task.soruSayisi)} soru`}</div>
            </div>
            <button type="button" class="plan-delete" aria-label="Görevi sil">✕</button>
        </li>`).join('');
}

function initPlanChecklist() {
    const listEl = document.getElementById('todayPlanList');
    if (!listEl) return;

    let tasks = loadTasks();
    renderTasks(tasks, listEl);

    listEl.addEventListener('click', e => {
        const checkBtn  = e.target.closest('.plan-check');
        const deleteBtn = e.target.closest('.plan-delete');

        if (checkBtn) {
            const id   = checkBtn.closest('.plan-item')?.dataset.taskId;
            const task = tasks.find(t => t.id === id);
            if (!task) return;
            task.done = !task.done;
            saveTasks(tasks);
            renderTasks(tasks, listEl);
            return;
        }

        if (deleteBtn) {
            const id = deleteBtn.closest('.plan-item')?.dataset.taskId;
            tasks = tasks.filter(t => t.id !== id);
            saveTasks(tasks);
            renderTasks(tasks, listEl);
        }
    });

    initAddTaskModal(tasks, saveTasks, () => renderTasks(tasks, listEl));
}

/* ================================================================
   3. Add-task modal (unchanged logic, same as before)
   ================================================================ */

function initAddTaskModal(tasks, persist, rerender) {
    const overlay     = document.getElementById('addTaskOverlay');
    const openBtn     = document.getElementById('openAddTaskBtn');
    const closeBtn    = document.getElementById('closeAddTaskBtn');
    const form        = document.getElementById('addTaskForm');
    const colorPicker = document.getElementById('colorPicker');
    if (!overlay || !openBtn || !form || !colorPicker) return;

    let selectedColor = colorPicker.querySelector('.color-swatch.selected')?.dataset.color || '#2563eb';

    const openModal = () => { overlay.hidden = false; document.getElementById('taskDers')?.focus(); };
    const closeModal = () => {
        overlay.hidden = true;
        form.reset();
        colorPicker.querySelectorAll('.color-swatch').forEach((s, i) => {
            s.classList.toggle('selected', i === 0);
            s.setAttribute('aria-pressed', String(i === 0));
        });
        selectedColor = colorPicker.querySelectorAll('.color-swatch')[0]?.dataset.color || '#2563eb';
    };

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });

    colorPicker.addEventListener('click', e => {
        const swatch = e.target.closest('.color-swatch');
        if (!swatch) return;
        colorPicker.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.remove('selected');
            s.setAttribute('aria-pressed', 'false');
        });
        swatch.classList.add('selected');
        swatch.setAttribute('aria-pressed', 'true');
        selectedColor = swatch.dataset.color;
    });

    form.addEventListener('submit', e => {
        e.preventDefault();
        const ders       = document.getElementById('taskDers').value.trim();
        const konu       = document.getElementById('taskKonu').value.trim();
        const soruSayisi = parseInt(document.getElementById('taskSoruSayisi').value, 10);
        if (!ders || !konu || soruSayisi < 1) return;

        tasks.push({ id: `t${Date.now()}`, ders, konu, soruSayisi, color: selectedColor, done: false });
        persist(tasks);
        rerender();
        closeModal();
    });
}

/* ================================================================
   4. SQLite database helpers
   ================================================================ */

function loadOrCreateDb(SQL) {
    // Try to restore a previously saved database from localStorage.
    try {
        const saved = localStorage.getItem(DB_STORAGE_KEY);
        if (saved) {
            const binary = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
            const db = new SQL.Database(binary);
            ensureSchema(db);
            return db;
        }
    } catch { /* corrupted — start fresh */ }

    const db = new SQL.Database();
    ensureSchema(db);
    persistDb(db);
    return db;
}

function ensureSchema(db) {
    db.run(`
        CREATE TABLE IF NOT EXISTS denemeler (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            tarih       TEXT    NOT NULL,
            mat_dogru   INTEGER NOT NULL DEFAULT 0,
            mat_yanlis  INTEGER NOT NULL DEFAULT 0,
            fen_dogru   INTEGER NOT NULL DEFAULT 0,
            fen_yanlis  INTEGER NOT NULL DEFAULT 0,
            sos_dogru   INTEGER NOT NULL DEFAULT 0,
            sos_yanlis  INTEGER NOT NULL DEFAULT 0,
            trk_dogru   INTEGER NOT NULL DEFAULT 0,
            trk_yanlis  INTEGER NOT NULL DEFAULT 0
        );
    `);
}

function persistDb(db) {
    try {
        const data   = db.export();                              // Uint8Array
        const base64 = btoa(String.fromCharCode(...data));
        localStorage.setItem(DB_STORAGE_KEY, base64);
    } catch { /* quota / private mode */ }
}

function calcNet(dogru, yanlis) {
    return Math.round((dogru - yanlis * 0.25) * 100) / 100;
}

function calcTotalNet(row) {
    return ['mat', 'fen', 'sos', 'trk'].reduce((sum, key) => {
        return sum + calcNet(row[`${key}_dogru`], row[`${key}_yanlis`]);
    }, 0);
}

function insertDeneme(db, data) {
    const today = new Date().toLocaleDateString('tr-TR');
    db.run(
        `INSERT INTO denemeler
            (tarih, mat_dogru, mat_yanlis, fen_dogru, fen_yanlis,
             sos_dogru, sos_yanlis, trk_dogru, trk_yanlis)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            today,
            data.mat_dogru,  data.mat_yanlis,
            data.fen_dogru,  data.fen_yanlis,
            data.sos_dogru,  data.sos_yanlis,
            data.trk_dogru,  data.trk_yanlis,
        ]
    );
    persistDb(db);
}

function fetchAllDenemeler(db) {
    const results = db.exec(
        'SELECT * FROM denemeler ORDER BY id DESC'
    );
    if (!results.length) return [];
    const { columns, values } = results[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
    });
}

function fetchLatestDeneme(db) {
    const rows = fetchAllDenemeler(db);
    return rows.length ? rows[0] : null;
}

/* ================================================================
   5. Deneme card display
   ================================================================ */

function renderLatestDeneme(db) {
    const container = document.getElementById('denemeDisplay');
    if (!container) return;

    const row = fetchLatestDeneme(db);
    if (!row) {
        container.innerHTML = '<div class="deneme-empty">Henüz deneme sonucu girilmedi.</div>';
        return;
    }

    const totalNet  = calcTotalNet(row);
    const maxNet    = SUBJECTS.reduce((sum, s) => sum + s.maxQ, 0); // 120
    const barPct    = Math.min(100, Math.round((totalNet / maxNet) * 100));

    const subjectRows = SUBJECTS.map(s => {
        const net = calcNet(row[`${s.key}_dogru`], row[`${s.key}_yanlis`]);
        return `
        <div class="subject-row">
            <span class="subject-dot" style="background-color:${s.color};"></span>
            <span>${escapeHtml(s.label)}</span>
            <span>${row[`${s.key}_dogru`]}D / ${row[`${s.key}_yanlis`]}Y
                  <span style="color:var(--slate-soft); font-weight:400;">(${net} net)</span>
            </span>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="stat-row">
            <span class="stat-number">${totalNet}</span>
            <span class="stat-delta">toplam net</span>
        </div>
        <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width:${barPct}%;"></div>
        </div>
        <div class="subject-breakdown" style="margin-top:1rem;">
            ${subjectRows}
        </div>
        <div style="font-size:0.78rem; color:var(--slate-soft); margin-top:0.8rem; text-align:right;">
            ${escapeHtml(row.tarih)}
        </div>`;
}

/* ================================================================
   6. Add-deneme modal
   ================================================================ */

function initDenemeForms(db) {
    // --- add-deneme modal ---
    const addOverlay  = document.getElementById('addDenemeOverlay');
    const openAddBtn  = document.getElementById('openAddDenemeBtn');
    const closeAddBtn = document.getElementById('closeAddDenemeBtn');
    const addForm     = document.getElementById('addDenemeForm');

    const openAdd  = () => { addOverlay.hidden = false; document.getElementById('mat_dogru')?.focus(); };
    const closeAdd = () => { addOverlay.hidden = true; addForm.reset(); };

    openAddBtn?.addEventListener('click', openAdd);
    closeAddBtn?.addEventListener('click', closeAdd);
    addOverlay?.addEventListener('click', e => { if (e.target === addOverlay) closeAdd(); });

    addForm?.addEventListener('submit', e => {
        e.preventDefault();

        const data = {};
        ['mat', 'fen', 'sos', 'trk'].forEach(key => {
            data[`${key}_dogru`]  = parseInt(document.getElementById(`${key}_dogru`).value,  10) || 0;
            data[`${key}_yanlis`] = parseInt(document.getElementById(`${key}_yanlis`).value, 10) || 0;
        });

        insertDeneme(db, data);
        renderLatestDeneme(db);
        closeAdd();
    });

    // --- history modal ---
    const histOverlay  = document.getElementById('denemeHistoryOverlay');
    const openHistBtn  = document.getElementById('openDenemeHistoryBtn');
    const closeHistBtn = document.getElementById('closeDenemeHistoryBtn');

    const openHistory = () => {
        renderDenemeHistory(db);
        histOverlay.hidden = false;
    };
    const closeHistory = () => { histOverlay.hidden = true; };

    openHistBtn?.addEventListener('click', openHistory);
    closeHistBtn?.addEventListener('click', closeHistory);
    histOverlay?.addEventListener('click', e => { if (e.target === histOverlay) closeHistory(); });

    // shared Escape handler
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!addOverlay.hidden)  closeAdd();
        if (!histOverlay.hidden) closeHistory();
    });
}

/* ================================================================
   7. Deneme history modal
   ================================================================ */

function renderDenemeHistory(db) {
    const container = document.getElementById('denemeHistoryContent');
    if (!container) return;

    const rows = fetchAllDenemeler(db);

    if (!rows.length) {
        container.innerHTML = '<p style="text-align:center; color:var(--slate-soft); padding:1.5rem 0;">Henüz deneme kaydı yok.</p>';
        return;
    }

    const headerCells = SUBJECTS.map(s =>
        `<th style="color:${s.color};">${escapeHtml(s.label)}</th>`
    ).join('');

    const bodyRows = rows.map(row => {
        const subjectCells = SUBJECTS.map(s => {
            const net = calcNet(row[`${s.key}_dogru`], row[`${s.key}_yanlis`]);
            return `<td>${row[`${s.key}_dogru`]}D/${row[`${s.key}_yanlis`]}Y <span style="color:var(--slate-soft)">${net}</span></td>`;
        }).join('');
        const total = calcTotalNet(row);
        return `
        <tr>
            <td>${escapeHtml(row.tarih)}</td>
            ${subjectCells}
            <td class="history-net">${total}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
    <div class="history-scroll">
        <table class="history-table">
            <thead>
                <tr>
                    <th>Tarih</th>
                    ${headerCells}
                    <th>Toplam Net</th>
                </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
        </table>
    </div>`;
}

/* ================================================================
   8. Quick access buttons
   ================================================================ */

function initQuickAccess() {
    document.querySelectorAll('.quick-access-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            // "yeni-deneme" wired to open the add-deneme modal
            if (action === 'yeni-deneme') {
                document.getElementById('openAddDenemeBtn')?.click();
                return;
            }
            // TODO: wire up remaining actions
            console.log(`Hızlı Erişim tıklandı: ${action}`);
        });
    });
}

/* ================================================================
   9. Daily motivational quote
   ================================================================ */

const QUOTES = [
    { text: 'Başarı, her gün tekrarlanan küçük çabaların toplamıdır.',                               author: 'Robert Collier'       },
    { text: 'Zor olan her şey, alışkanlık haline gelmeden önce zordur.',                              author: 'Johann W. von Goethe' },
    { text: 'Bugün yapabileceğini yarına bırakma.',                                                   author: 'Benjamin Franklin'    },
    { text: 'Başarının sırrı, başlamaktır.',                                                          author: 'Mark Twain'           },
    { text: 'Bir insanın yapabileceklerinin sınırı, hayal edebilecekleriyle doğru orantılıdır.',      author: 'Albert Einstein'      },
    { text: 'Düşmek başarısızlık değildir; düştükten sonra olduğun yerde kalmak başarısızlıktır.',    author: 'Mary Pickford'        },
    { text: 'Çalışmak, en güvenilir şans kaynağıdır.',                                               author: 'Thomas Jefferson'     },
    { text: 'İnsanlar neden hedeflerine ulaşamaz? Çünkü onları hayal etmekle yetinirler.',            author: 'Paulo Coelho'         },
    { text: 'Bugün acı çekerek çalışmak, yarın zaferle gülmek demektir.',                             author: 'Mustafa Kemal Atatürk'},
    { text: 'Azim, yeteneği her zaman yener.',                                                        author: 'Arthur Schopenhauer'  },
    { text: 'Başarı bir yolculuktur, varış noktası değil.',                                           author: 'Arthur Ashe'          },
    { text: 'Büyük işler, büyük emeklerle yapılır.',                                                  author: 'Aristoteles'          },
    { text: 'Kendine inan; bütün yarı kazanılmış demektir.',                                          author: 'Theodore Roosevelt'   },
    { text: 'Hiçbir şey çalışmak kadar güçlü bir teselli veremez.',                                  author: 'Anne Frank'           },
    { text: 'Gelecek, hayallerinin güzelliğine inananlarındır.',                                      author: 'Eleanor Roosevelt'    },
];

function initDailyQuote() {
    const textEl   = document.getElementById('quoteText');
    const authorEl = document.getElementById('quoteAuthor');
    if (!textEl || !authorEl) return;

    // Pick a quote by day-of-year so it's stable all day and advances at midnight.
    const now        = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear  = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
    const quote      = QUOTES[dayOfYear % QUOTES.length];

    textEl.textContent   = quote.text;
    authorEl.textContent = '— ' + quote.author;
}

/* ================================================================
   10. User menu dropdown
   ================================================================ */

function initUserMenu() {
    // Read user data saved by signup.js
    let user = { firstName: '', lastName: '', email: '' };
    try {
        const raw = localStorage.getItem('registeredUser');
        if (raw) user = { ...user, ...JSON.parse(raw) };
    } catch { /* no saved user — fall back to defaults */ }

    const initials = [user.firstName, user.lastName]
        .map(n => n?.charAt(0).toUpperCase())
        .filter(Boolean)
        .join('') || 'AY';

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Kullanıcı';

    // Update nav avatar button
    const navAvatar = document.getElementById('userMenuBtn');
    if (navAvatar) navAvatar.textContent = initials;

    // Update hero greeting
    const heroH1 = document.querySelector('.dash-hero h1');
    if (heroH1 && user.firstName) {
        heroH1.textContent = `Tekrar hoş geldin, ${user.firstName}.`;
    }

    // Fill dropdown
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownName   = document.getElementById('dropdownName');
    const dropdownEmail  = document.getElementById('dropdownEmail');
    if (dropdownAvatar) dropdownAvatar.textContent = initials;
    if (dropdownName)   dropdownName.textContent   = fullName;
    if (dropdownEmail)  dropdownEmail.textContent  = user.email || '';

    // Toggle open/close
    const menuBtn    = document.getElementById('userMenuBtn');
    const dropdown   = document.getElementById('userDropdown');
    if (!menuBtn || !dropdown) return;

    const openMenu  = () => {
        dropdown.hidden = false;
        menuBtn.setAttribute('aria-expanded', 'true');
    };
    const closeMenu = () => {
        dropdown.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
    };

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.hidden ? openMenu() : closeMenu();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.hidden && !dropdown.contains(e.target)) closeMenu();
    });

    // Close on Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dropdown.hidden) closeMenu();
    });

    // Action buttons
    dropdown.querySelectorAll('.user-dropdown-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'logout') {
                window.location.href = 'index.html';
            } else if (action === 'profile') {
                window.location.href = '#'; // TODO: profile page
            }
            closeMenu();
        });
    });
}