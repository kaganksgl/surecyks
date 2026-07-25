// main.js — Süreç YKS dashboard interactions

/* ================================================================
   Constants
   ================================================================ */

// Legacy localStorage keys — only read during the one-time migration to
// server-side storage (see migrateLegacyDataIfNeeded), never written again.
const PLAN_STORAGE_KEY = 'surecYksTodayPlan';
const DB_STORAGE_KEY   = 'surecYksDenemesDB';

// Sınav türlerine göre alt testler. AYT, öğrencinin alanına (Sayısal /
// Eşit Ağırlık / Sözel) göre farklı derslerden oluştuğu için "fields" ile
// ayrıştırılıyor; TYT ve YDT herkes için aynı.
const EXAM_TYPES = {
    TYT: {
        label: 'TYT',
        fields: null,
        subjects: [
            { key: 'tyt_turkce',    label: 'Türkçe',          color: '#7c3aed', maxQ: 40 },
            { key: 'tyt_sosyal',    label: 'Sosyal Bilimler', color: '#f59e0b', maxQ: 20 },
            { key: 'tyt_matematik', label: 'Matematik',       color: '#2563eb', maxQ: 40 },
            { key: 'tyt_fen',       label: 'Fen Bilimleri',   color: '#16a34a', maxQ: 20 },
        ],
    },
    AYT: {
        label: 'AYT',
        fields: {
            sayisal: {
                label: 'Sayısal',
                subjects: [
                    { key: 'ayt_matematik', label: 'Matematik', color: '#2563eb', maxQ: 40 },
                    { key: 'ayt_fizik',     label: 'Fizik',     color: '#0891b2', maxQ: 14 },
                    { key: 'ayt_kimya',     label: 'Kimya',     color: '#16a34a', maxQ: 13 },
                    { key: 'ayt_biyoloji',  label: 'Biyoloji',  color: '#65a30d', maxQ: 13 },
                ],
            },
            ea: {
                label: 'Eşit Ağırlık',
                subjects: [
                    { key: 'ayt_matematik', label: 'Matematik',                 color: '#2563eb', maxQ: 40 },
                    { key: 'ayt_edebiyat',  label: 'Edebiyat-Sosyal Bilimler 1', color: '#7c3aed', maxQ: 40 },
                ],
            },
            sozel: {
                label: 'Sözel',
                subjects: [
                    { key: 'ayt_edebiyat', label: 'Edebiyat-Sosyal Bilimler 1', color: '#7c3aed', maxQ: 40 },
                    { key: 'ayt_sosyal2',  label: 'Sosyal Bilimler 2',          color: '#f59e0b', maxQ: 40 },
                ],
            },
        },
    },
    YDT: {
        label: 'YDT',
        fields: null,
        subjects: [
            { key: 'ydt', label: 'Yabancı Dil', color: '#db2777', maxQ: 80 },
        ],
    },
};

function getSubjectsFor(examType, alan) {
    const cfg = EXAM_TYPES[examType];
    if (!cfg) return [];
    if (cfg.fields) return (cfg.fields[alan] || {}).subjects || [];
    return cfg.subjects;
}

function examTypeLabel(row) {
    if (row.sinav_turu === 'AYT' && row.alan) {
        const alanLabel = EXAM_TYPES.AYT.fields[row.alan]?.label || row.alan;
        return `AYT · ${alanLabel}`;
    }
    return EXAM_TYPES[row.sinav_turu]?.label || row.sinav_turu;
}

/* ================================================================
   Bootstrap
   ================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    initCountdown();
    initUserMenu(user);
    initQuickAccess();
    initDailyQuote();

    // One-time bridge for accounts that still have their tasks/mock-exam
    // data sitting in this browser's localStorage from before everything
    // moved to the account on the server. Must finish before the first
    // fetch of tasks/denemeler below, or the freshly-imported rows won't
    // show up until the next reload.
    await migrateLegacyDataIfNeeded(user);

    initStreak();
    initPlanChecklist();
    initDenemeForms();
    renderLatestDeneme();
    renderNetChart();
    renderStatsStrip();

    document.addEventListener('surecyks:langchange', () => {
        initStreak();
        renderStatsStrip();
        renderLatestDeneme();
        renderNetChart();
    });
});

async function requireAuth() {
    try {
        const response = await fetch('/api/me');
        if (!response.ok) {
            window.location.href = 'index.html';
            return null;
        }
        const data = await response.json();
        return data.user;
    } catch (err) {
        window.location.href = 'index.html';
        return null;
    }
}

/* ================================================================
   1z. One-time localStorage → account migration
   ================================================================ */

// Scoped per-account (not just per-browser) so switching accounts on the
// same machine doesn't skip a legitimate migration for the second account.
function migrationDoneKey(user) {
    return `surecYksMigratedToServer:${user.email}`;
}

async function migrateLegacyDataIfNeeded(user) {
    const doneKey = migrationDoneKey(user);
    if (localStorage.getItem(doneKey)) return;

    const legacyTasksRaw = localStorage.getItem(PLAN_STORAGE_KEY);
    const legacyDbRaw    = localStorage.getItem(DB_STORAGE_KEY);

    if (!legacyTasksRaw && !legacyDbRaw) {
        localStorage.setItem(doneKey, '1');
        return;
    }

    const payload = { tasks: [], denemeler: [] };

    if (legacyTasksRaw) {
        try {
            const parsed = JSON.parse(legacyTasksRaw);
            if (Array.isArray(parsed)) {
                payload.tasks = parsed.map(task => ({
                    ders: task.ders,
                    konu: task.konu,
                    soruSayisi: parseInt(task.soruSayisi, 10) || 0,
                    color: task.color || '#2563eb',
                    done: !!task.done,
                }));
            }
        } catch { /* corrupted — skip legacy tasks */ }
    }

    if (legacyDbRaw) {
        try {
            // sql.js only needs to load for this one-time read of the old
            // browser-local database; accounts that migrate cleanly never
            // touch it again.
            const SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
            });
            const binary = Uint8Array.from(atob(legacyDbRaw), c => c.charCodeAt(0));
            const legacyDb = new SQL.Database(binary);
            const results = legacyDb.exec('SELECT * FROM denemeler');
            if (results.length) {
                const { columns, values } = results[0];
                payload.denemeler = values.map(row => {
                    const obj = {};
                    columns.forEach((col, i) => { obj[col] = row[i]; });
                    return obj;
                });
            }
        } catch (err) {
            console.error('Eski deneme veritabanı okunamadı:', err);
        }
    }

    if (payload.tasks.length || payload.denemeler.length) {
        try {
            await fetch('/api/migrate-legacy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.error('Veriler sunucuya aktarılamadı, tekrar denenecek:', err);
            return; // leave the done-flag unset so the next load retries
        }
    }

    localStorage.setItem(doneKey, '1');
    localStorage.removeItem(PLAN_STORAGE_KEY);
    localStorage.removeItem(DB_STORAGE_KEY);
}

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

    const dateEl = document.getElementById('countdownDate');
    const renderDate = () => {
        if (!dateEl) return;
        const locale = getLang() === 'en' ? 'en-US' : 'tr-TR';
        const formatted = examDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
        dateEl.textContent = t('countdown.examDate', { date: formatted });
    };
    renderDate();
    document.addEventListener('surecyks:langchange', renderDate);
}

/* ================================================================
   1b. Daily streak — consecutive days the dashboard has been opened,
       tracked server-side so it follows the account across devices.
   ================================================================ */

// Highest tier reached is shown as a badge; each entry only needs the day
// threshold since the label comes from i18n and the emoji is decorative.
const STREAK_MILESTONES = [
    { days: 3,   emoji: '🔥' },
    { days: 7,   emoji: '⚡' },
    { days: 15,  emoji: '🌟' },
    { days: 30,  emoji: '🏆' },
    { days: 50,  emoji: '💎' },
    { days: 100, emoji: '👑' },
];

function highestMilestone(count) {
    let current = null;
    for (const milestone of STREAK_MILESTONES) {
        if (count >= milestone.days) current = milestone;
    }
    return current;
}

async function initStreak() {
    const el = document.getElementById('streakText');
    const badge = document.getElementById('streakMilestoneBadge');
    if (!el) return;

    const todayIso = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, timezone-safe
    let count = 0;
    let newMilestone = null;
    try {
        const res = await fetch(`/api/streak?today=${todayIso}`);
        if (res.ok) ({ count, newMilestone } = await res.json());
    } catch { /* offline — leave streak text at its default */ }

    el.textContent = t('hero.streak', { n: count });

    if (!badge) return;
    const tier = highestMilestone(count);
    if (!tier) {
        badge.hidden = true;
        return;
    }
    badge.hidden = false;
    badge.textContent = `${tier.emoji} ${t('streak.milestone', { n: tier.days })}`;
    // Only pop the animation the day a new tier is actually reached, not on
    // every reload of an already-celebrated streak.
    badge.classList.remove('pop');
    if (newMilestone) {
        void badge.offsetWidth; // restart the animation if it's mid-flight
        badge.classList.add('pop');
    }
}

/* ================================================================
   1c. Colorful stats strip — at-a-glance streak / tasks / latest score
   ================================================================ */

async function renderStatsStrip() {
    const container = document.getElementById('statsStrip');
    if (!container) return;

    const tasks = await apiFetchTasks();
    const doneCount = tasks.filter(task => task.done).length;
    const solvedToday = tasks
        .filter(task => task.done)
        .reduce((sum, task) => sum + (parseInt(task.soruSayisi, 10) || 0), 0);

    let netValue = '—';
    let netLabel = t('deneme.totalNet');
    const latest = await fetchLatestDeneme();
    if (latest) {
        netValue = String(calcTotalNet(latest));
        netLabel = `${examTypeLabel(latest)} · ${t('deneme.totalNet')}`;
    }

    container.innerHTML = `
        <div class="stat-tile stat-tile--amber">
            <span class="stat-tile-icon">📝</span>
            <span class="stat-tile-value">${solvedToday}</span>
            <span class="stat-tile-label">${escapeHtml(t('stats.solvedToday'))}</span>
        </div>
        <div class="stat-tile stat-tile--teal">
            <span class="stat-tile-icon">✅</span>
            <span class="stat-tile-value">${doneCount}/${tasks.length}</span>
            <span class="stat-tile-label">${escapeHtml(t('plan.title'))}</span>
        </div>
        <div class="stat-tile stat-tile--violet">
            <span class="stat-tile-icon">🎯</span>
            <span class="stat-tile-value">${escapeHtml(netValue)}</span>
            <span class="stat-tile-label">${escapeHtml(netLabel)}</span>
        </div>`;
}

/* ================================================================
   2. Today's plan (tasks)
   ================================================================ */

async function apiFetchTasks() {
    try {
        const res = await fetch('/api/tasks');
        return res.ok ? res.json() : [];
    } catch { return []; }
}

async function apiCreateTask(task) {
    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
        });
        return res.ok ? res.json() : null;
    } catch { return null; }
}

async function apiToggleTask(id, done) {
    try {
        await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ done }),
        });
    } catch { /* best-effort — UI already reflects the change optimistically */ }
}

async function apiDeleteTask(id) {
    try { await fetch(`/api/tasks/${id}`, { method: 'DELETE' }); }
    catch { /* best-effort — UI already reflects the change optimistically */ }
}

function escapeHtml(value) {
    const d = document.createElement('div');
    d.textContent = String(value);
    return d.innerHTML;
}

function updateHeroText(tasks) {
    const el = document.getElementById('heroTaskText');
    if (!el) return;

    const remaining = tasks.filter(task => !task.done).length;

    if (tasks.length === 0) {
        el.textContent = t('hero.noTasks');
    } else if (remaining === 0) {
        el.textContent = t('hero.allDone');
    } else if (remaining === 1) {
        el.textContent = t('hero.oneTask');
    } else {
        el.textContent = t('hero.manyTasks', { n: remaining });
    }
}

function renderTasks(tasks, listEl) {
    updateHeroText(tasks);
    renderStatsStrip();

    if (tasks.length === 0) {
        listEl.innerHTML = `<li class="plan-empty">${escapeHtml(t('plan.empty'))}</li>`;
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
                <div class="plan-meta">${task.done ? escapeHtml(t('plan.done')) : escapeHtml(t('plan.questionCount', { n: task.soruSayisi }))}</div>
            </div>
            <button type="button" class="plan-delete" aria-label="${escapeHtml(t('plan.deleteTask'))}">🗑️</button>
        </li>`).join('');
}

async function initPlanChecklist() {
    const listEl = document.getElementById('todayPlanList');
    if (!listEl) return;

    // Mutated in place from here on (push/splice) rather than reassigned,
    // so this exact array reference can be shared with initAddTaskModal
    // without either side working off a stale copy.
    const tasks = await apiFetchTasks();
    const rerender = () => renderTasks(tasks, listEl);
    rerender();

    listEl.addEventListener('click', async e => {
        const checkBtn  = e.target.closest('.plan-check');
        const deleteBtn = e.target.closest('.plan-delete');

        if (checkBtn) {
            const id   = Number(checkBtn.closest('.plan-item')?.dataset.taskId);
            const task = tasks.find(t => t.id === id);
            if (!task) return;
            task.done = !task.done;
            rerender();
            await apiToggleTask(id, task.done);
            return;
        }

        if (deleteBtn) {
            const id = Number(deleteBtn.closest('.plan-item')?.dataset.taskId);
            const index = tasks.findIndex(t => t.id === id);
            if (index === -1) return;
            tasks.splice(index, 1);
            rerender();
            await apiDeleteTask(id);
        }
    });

    initAddTaskModal(tasks, rerender);

    document.addEventListener('surecyks:langchange', rerender);
}

/* ================================================================
   3. Add-task modal
   ================================================================ */

function initAddTaskModal(tasks, rerender) {
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

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const ders       = document.getElementById('taskDers').value.trim();
        const konu       = document.getElementById('taskKonu').value.trim();
        const soruSayisi = parseInt(document.getElementById('taskSoruSayisi').value, 10);
        if (!ders || !konu || soruSayisi < 1) return;

        closeModal();
        const created = await apiCreateTask({ ders, konu, soruSayisi, color: selectedColor });
        if (!created) return;
        tasks.push(created);
        rerender();
    });
}

/* ================================================================
   4. Mock exam (deneme) API helpers
   ================================================================ */

async function insertDeneme(examType, alan, data, tarih) {
    const body = { tarih, sinav_turu: examType, alan, ...data };
    try {
        const res = await fetch('/api/denemeler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return res.ok ? res.json() : null;
    } catch { return null; }
}

async function fetchAllDenemeler() {
    let rows;
    try {
        const res = await fetch('/api/denemeler');
        rows = res.ok ? await res.json() : [];
    } catch { rows = []; }
    // Entries can be backfilled for past dates, so the true chronological
    // order (most recent first) has to follow the picked "tarih", not
    // insertion id. Ties (same day) fall back to insertion order.
    rows.sort((a, b) => parseTarih(b.tarih) - parseTarih(a.tarih) || b.id - a.id);
    return rows;
}

async function fetchLatestDeneme() {
    const rows = await fetchAllDenemeler();
    return rows.length ? rows[0] : null;
}

async function deleteDeneme(id) {
    try { await fetch(`/api/denemeler/${id}`, { method: 'DELETE' }); }
    catch { /* best-effort — UI already reflects the change optimistically */ }
}

function calcNet(dogru, yanlis) {
    return Math.round((dogru - yanlis * 0.25) * 100) / 100;
}

function getRowSubjects(row) {
    return getSubjectsFor(row.sinav_turu, row.alan);
}

function calcTotalNet(row) {
    return getRowSubjects(row).reduce((sum, s) => {
        return sum + calcNet(row[`${s.key}_dogru`], row[`${s.key}_yanlis`]);
    }, 0);
}

function getMaxNet(row) {
    return getRowSubjects(row).reduce((sum, s) => sum + s.maxQ, 0);
}

/* ================================================================
   5. Deneme card display
   ================================================================ */

async function renderLatestDeneme() {
    const container = document.getElementById('denemeDisplay');
    if (!container) return;

    const row = await fetchLatestDeneme();
    if (!row) {
        container.innerHTML = `<div class="deneme-empty">${escapeHtml(t('deneme.empty'))}</div>`;
        return;
    }

    const subjects  = getRowSubjects(row);
    const totalNet  = calcTotalNet(row);
    const maxNet    = getMaxNet(row);
    const barPct    = maxNet ? Math.min(100, Math.round((totalNet / maxNet) * 100)) : 0;
    const correctAbbr = escapeHtml(t('deneme.correctAbbr'));
    const wrongAbbr   = escapeHtml(t('deneme.wrongAbbr'));
    const netSuffix   = escapeHtml(t('deneme.netSuffix'));

    const subjectRows = subjects.map(s => {
        const net = calcNet(row[`${s.key}_dogru`], row[`${s.key}_yanlis`]);
        return `
        <div class="subject-row">
            <span class="subject-dot" style="background-color:${s.color};"></span>
            <span>${escapeHtml(s.label)}</span>
            <span>${row[`${s.key}_dogru`]}${correctAbbr} / ${row[`${s.key}_yanlis`]}${wrongAbbr}
                  <span style="color:var(--slate-soft); font-weight:400;">(${net} ${netSuffix})</span>
            </span>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="stat-row">
            <span class="stat-number">${totalNet}</span>
            <span class="stat-delta">${escapeHtml(examTypeLabel(row))} · ${escapeHtml(t('deneme.totalNet'))}</span>
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

function renderDenemeSubjectFields(examType, alan) {
    const grid = document.getElementById('denemeSubjectGrid');
    if (!grid) return;

    const subjects = getSubjectsFor(examType, alan);
    grid.innerHTML = subjects.map(s => `
        <div class="deneme-subject-block">
            <div class="deneme-subject-label" style="color:${s.color};">${escapeHtml(s.label)} <span style="color:var(--slate-soft); font-weight:400;">(${escapeHtml(t('modal.addDeneme.questionsSuffix', { n: s.maxQ }))})</span></div>
            <div class="deneme-input-row">
                <label class="modal-label" for="${s.key}_dogru">${escapeHtml(t('modal.addDeneme.correct'))}</label>
                <input type="number" id="${s.key}_dogru" name="${s.key}_dogru" min="0" max="${s.maxQ}" placeholder="0" required>
            </div>
            <div class="deneme-input-row">
                <label class="modal-label" for="${s.key}_yanlis">${escapeHtml(t('modal.addDeneme.wrong'))}</label>
                <input type="number" id="${s.key}_yanlis" name="${s.key}_yanlis" min="0" max="${s.maxQ}" placeholder="0" required>
            </div>
        </div>`).join('');

    // A subject's doğru + yanlış can never exceed its real question count
    // (e.g. TYT Türkçe is 40 questions total, not 40 doğru AND separately 40 yanlış).
    subjects.forEach(s => {
        const dogruEl  = document.getElementById(`${s.key}_dogru`);
        const yanlisEl = document.getElementById(`${s.key}_yanlis`);
        if (!dogruEl || !yanlisEl) return;

        const validate = () => {
            const dogru  = parseInt(dogruEl.value, 10)  || 0;
            const yanlis = parseInt(yanlisEl.value, 10) || 0;
            const message = (dogru + yanlis > s.maxQ)
                ? t('modal.addDeneme.validation', { subject: s.label, max: s.maxQ })
                : '';
            dogruEl.setCustomValidity(message);
            yanlisEl.setCustomValidity(message);
        };

        dogruEl.addEventListener('input', validate);
        yanlisEl.addEventListener('input', validate);
    });
}

function initDenemeForms() {
    // --- add-deneme modal ---
    const addOverlay      = document.getElementById('addDenemeOverlay');
    const openAddBtn      = document.getElementById('openAddDenemeBtn');
    const closeAddBtn     = document.getElementById('closeAddDenemeBtn');
    const addForm         = document.getElementById('addDenemeForm');
    const tarihInput      = document.getElementById('denemeTarih');
    const sinavTuruSelect = document.getElementById('denemeSinavTuru');
    const alanField       = document.getElementById('denemeAlanField');
    const alanSelect      = document.getElementById('denemeAlan');
    const subjectGrid     = document.getElementById('denemeSubjectGrid');

    function syncDenemeFields() {
        const examType = sinavTuruSelect.value;
        const isAyt = examType === 'AYT';
        alanField.hidden = !isAyt;
        alanSelect.required = isAyt;

        if (!examType) {
            subjectGrid.innerHTML = '';
            return;
        }
        renderDenemeSubjectFields(examType, isAyt ? alanSelect.value : null);
    }

    const openAdd  = () => {
        addOverlay.hidden = false;
        if (tarihInput) {
            const todayIso = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
            tarihInput.max = todayIso;
            if (!tarihInput.value) tarihInput.value = todayIso;
        }
        sinavTuruSelect?.focus();
    };
    const closeAdd = () => {
        addOverlay.hidden = true;
        addForm.reset();
        syncDenemeFields();
    };

    openAddBtn?.addEventListener('click', openAdd);
    closeAddBtn?.addEventListener('click', closeAdd);
    addOverlay?.addEventListener('click', e => { if (e.target === addOverlay) closeAdd(); });

    sinavTuruSelect?.addEventListener('change', syncDenemeFields);
    alanSelect?.addEventListener('change', syncDenemeFields);

    addForm?.addEventListener('submit', async e => {
        e.preventDefault();

        const examType = sinavTuruSelect.value;
        if (!examType) return;
        if (!tarihInput.value) return;
        const alan = examType === 'AYT' ? alanSelect.value : null;
        const subjects = getSubjectsFor(examType, alan);
        if (!subjects.length) return;

        const data = {};
        subjects.forEach(s => {
            data[`${s.key}_dogru`]  = parseInt(document.getElementById(`${s.key}_dogru`).value,  10) || 0;
            data[`${s.key}_yanlis`] = parseInt(document.getElementById(`${s.key}_yanlis`).value, 10) || 0;
        });

        const tarih = isoToTarih(tarihInput.value);
        closeAdd();
        await insertDeneme(examType, alan, data, tarih);
        await renderLatestDeneme();
        await renderNetChart();
        renderStatsStrip();
    });

    // --- history modal ---
    const histOverlay  = document.getElementById('denemeHistoryOverlay');
    const openHistBtn  = document.getElementById('openDenemeHistoryBtn');
    const closeHistBtn = document.getElementById('closeDenemeHistoryBtn');

    const openHistory = async () => {
        histOverlay.hidden = false;
        await renderDenemeHistory();
    };
    const closeHistory = () => { histOverlay.hidden = true; };

    openHistBtn?.addEventListener('click', openHistory);
    closeHistBtn?.addEventListener('click', closeHistory);
    histOverlay?.addEventListener('click', e => { if (e.target === histOverlay) closeHistory(); });

    const histContainer = document.getElementById('denemeHistoryContent');
    histContainer?.addEventListener('click', async e => {
        const delBtn = e.target.closest('.history-delete');
        if (!delBtn) return;
        const id = Number(delBtn.closest('tr')?.dataset.id);
        if (!id) return;
        await deleteDeneme(id);
        await renderDenemeHistory();
        await renderLatestDeneme();
        await renderNetChart();
        renderStatsStrip();
    });

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

async function renderDenemeHistory() {
    const container = document.getElementById('denemeHistoryContent');
    if (!container) return;

    const rows = await fetchAllDenemeler();

    if (!rows.length) {
        container.innerHTML = `<p style="text-align:center; color:var(--slate-soft); padding:1.5rem 0;">${escapeHtml(t('deneme.historyEmpty'))}</p>`;
        return;
    }

    const correctAbbr = escapeHtml(t('deneme.correctAbbr'));
    const wrongAbbr   = escapeHtml(t('deneme.wrongAbbr'));

    const bodyRows = rows.map(row => {
        const subjects = getRowSubjects(row);
        const detail = subjects.map(s => {
            const net = calcNet(row[`${s.key}_dogru`], row[`${s.key}_yanlis`]);
            return `<span style="color:${s.color}; font-weight:600;">${escapeHtml(s.label)}</span> ${row[`${s.key}_dogru`]}${correctAbbr}/${row[`${s.key}_yanlis`]}${wrongAbbr} (${net})`;
        }).join(', ');
        const total = calcTotalNet(row);
        return `
        <tr data-id="${row.id}">
            <td>${escapeHtml(row.tarih)}</td>
            <td>${escapeHtml(examTypeLabel(row))}</td>
            <td>${detail}</td>
            <td class="history-net">${total}</td>
            <td><button type="button" class="history-delete" aria-label="${escapeHtml(t('deneme.deleteEntry'))}">🗑️</button></td>
        </tr>`;
    }).join('');

    container.innerHTML = `
    <div class="history-scroll">
        <table class="history-table">
            <thead>
                <tr>
                    <th>${escapeHtml(t('deneme.colDate'))}</th>
                    <th>${escapeHtml(t('deneme.colExamType'))}</th>
                    <th>${escapeHtml(t('deneme.colDetail'))}</th>
                    <th>${escapeHtml(t('deneme.colTotalNet'))}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
        </table>
    </div>`;
}

/* ================================================================
   7b. Net tracking chart (progress over time)
   ================================================================ */

// Fixed categorical assignment, validated for CVD-safe adjacent contrast
// (dataviz skill slots 1/2/3: blue/green/magenta).
const CHART_SERIES_COLOR = { TYT: '#2a78d6', AYT: '#008300', YDT: '#e87ba4' };

function debounce(fn, wait) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

function parseTarih(str) {
    const [d, m, y] = str.split('.').map(Number);
    return new Date(y, m - 1, d).getTime();
}

// Converts a <input type="date"> value ("YYYY-MM-DD") to the stored
// "DD.MM.YYYY" format (matches Date#toLocaleDateString('tr-TR')).
function isoToTarih(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}

async function renderNetChart() {
    const container = document.getElementById('netChartContainer');
    if (!container) return;

    const rows = (await fetchAllDenemeler()).slice().reverse(); // ascending chronological
    if (!rows.length) {
        container.innerHTML = `<div class="deneme-empty">${escapeHtml(t('deneme.chartEmpty'))}</div>`;
        return;
    }

    const points = rows.map((row, i) => ({
        index:  i,
        x:      parseTarih(row.tarih),
        net:    calcTotalNet(row),
        maxNet: getMaxNet(row),
        type:   row.sinav_turu,
        label:  examTypeLabel(row),
        tarih:  row.tarih,
    }));

    const orderedTypes = ['TYT', 'AYT', 'YDT'].filter(t => points.some(p => p.type === t));

    const width  = Math.max(280, container.clientWidth || 560);
    const height = 220;
    const padding = { top: 16, right: 16, bottom: 24, left: 34 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const xs = points.map(p => p.x);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const singleX = xMin === xMax;

    const nets = points.map(p => p.net);
    const maxNets = points.map(p => p.maxNet);
    const yMin = Math.min(0, ...nets);
    const yMax = Math.max(...maxNets);
    const yRange = yMax - yMin || 1;

    const scaleX = x => singleX ? padding.left + plotW / 2 : padding.left + ((x - xMin) / (xMax - xMin)) * plotW;
    const scaleY = y => padding.top + plotH - ((y - yMin) / yRange) * plotH;

    const GRID_STEPS = 4;
    const gridSvg = Array.from({ length: GRID_STEPS + 1 }, (_, i) => {
        const value = yMin + (yRange * i) / GRID_STEPS;
        const y = scaleY(value);
        const isBaseline = yMin < 0 && Math.abs(value) < yRange / (GRID_STEPS * 2);
        return `
        <line class="${isBaseline ? 'net-chart-baseline' : 'net-chart-gridline'}" x1="${padding.left}" x2="${width - padding.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"></line>
        <text class="net-chart-axis-label" x="${padding.left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${Math.round(value * 10) / 10}</text>`;
    }).join('');

    const linesSvg = orderedTypes.map(t => {
        const pts = points.filter(p => p.type === t);
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(1)} ${scaleY(p.net).toFixed(1)}`).join(' ');
        return `<path class="net-chart-line" d="${d}" stroke="${CHART_SERIES_COLOR[t]}"></path>`;
    }).join('');

    const pointsSvg = points.map(p => `
        <circle class="net-chart-point" data-index="${p.index}" cx="${scaleX(p.x).toFixed(1)}" cy="${scaleY(p.net).toFixed(1)}" r="4" fill="${CHART_SERIES_COLOR[p.type]}"></circle>
        <circle class="net-chart-hit" data-index="${p.index}" cx="${scaleX(p.x).toFixed(1)}" cy="${scaleY(p.net).toFixed(1)}" r="12"
                tabindex="0" role="img" aria-label="${escapeHtml(p.label)}, ${escapeHtml(p.tarih)}, ${p.net} net"></circle>`).join('');

    const firstLabel = escapeHtml(points[0].tarih);
    const lastLabel  = escapeHtml(points[points.length - 1].tarih);
    const xAxisSvg = singleX ? '' : `
        <text class="net-chart-axis-label" x="${padding.left}" y="${height - 6}" text-anchor="start">${firstLabel}</text>
        <text class="net-chart-axis-label" x="${width - padding.right}" y="${height - 6}" text-anchor="end">${lastLabel}</text>`;

    const legendHtml = orderedTypes.length > 1 ? `
        <div class="net-chart-legend">
            ${orderedTypes.map(t => `
                <span class="net-chart-legend-item">
                    <span class="net-chart-legend-swatch" style="background-color:${CHART_SERIES_COLOR[t]};"></span>
                    ${escapeHtml(EXAM_TYPES[t].label)}
                </span>`).join('')}
        </div>` : '';

    container.innerHTML = `
        ${legendHtml}
        <div class="net-chart-wrap">
            <svg class="net-chart-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Deneme net takibi grafiği, zaman içindeki toplam netler">
                ${gridSvg}
                ${linesSvg}
                ${pointsSvg}
                ${xAxisSvg}
            </svg>
            <div class="net-chart-tooltip" id="netChartTooltip"></div>
        </div>`;

    wireNetChartInteraction(container, points);
}

function wireNetChartInteraction(container, points) {
    const wrap = container.querySelector('.net-chart-wrap');
    const tooltip = container.querySelector('#netChartTooltip');
    if (!wrap || !tooltip) return;

    const showTooltip = (hitEl) => {
        const p = points[Number(hitEl.dataset.index)];
        if (!p) return;

        const pointEl = container.querySelector(`.net-chart-point[data-index="${p.index}"]`);
        pointEl?.setAttribute('r', 6);

        tooltip.replaceChildren();
        const row = document.createElement('div');
        row.className = 'net-chart-tooltip-row';
        const key = document.createElement('span');
        key.className = 'net-chart-tooltip-key';
        key.style.backgroundColor = CHART_SERIES_COLOR[p.type];
        const label = document.createElement('span');
        label.textContent = `${p.label} · ${p.tarih}`;
        const value = document.createElement('span');
        value.className = 'net-chart-tooltip-value';
        value.textContent = `${p.net} net`;
        row.append(key, label, value);
        tooltip.appendChild(row);

        const wrapRect = wrap.getBoundingClientRect();
        const hitRect = hitEl.getBoundingClientRect();
        tooltip.style.left = `${hitRect.left - wrapRect.left + hitRect.width / 2}px`;
        tooltip.style.top  = `${hitRect.top - wrapRect.top}px`;
        tooltip.classList.add('visible');

        wrap.dataset.activeIndex = String(p.index);
    };

    const hideTooltip = () => {
        tooltip.classList.remove('visible');
        const activeIndex = wrap.dataset.activeIndex;
        if (activeIndex !== undefined) {
            container.querySelector(`.net-chart-point[data-index="${activeIndex}"]`)?.setAttribute('r', 4);
        }
        delete wrap.dataset.activeIndex;
    };

    container.querySelectorAll('.net-chart-hit').forEach(el => {
        el.addEventListener('mouseenter', () => showTooltip(el));
        el.addEventListener('mouseleave', hideTooltip);
        el.addEventListener('focus', () => showTooltip(el));
        el.addEventListener('blur', hideTooltip);
        el.addEventListener('click', () => showTooltip(el));
    });
}

// Hide any open chart tooltip when tapping elsewhere (touch devices have no
// hover/blur to fall back on). Registered once — the chart re-renders its
// DOM on every insert, but this listener doesn't hold stale references.
document.addEventListener('click', (e) => {
    if (e.target.closest('.net-chart-hit')) return;
    document.querySelectorAll('.net-chart-tooltip.visible').forEach(t => t.classList.remove('visible'));
});

window.addEventListener('resize', debounce(() => {
    renderNetChart();
}, 200));

/* ================================================================
   8. Quick access buttons
   ================================================================ */

function initQuickAccess() {
    const actions = {
        'yeni-gorev': 'openAddTaskBtn',
        'yeni-deneme': 'openAddDenemeBtn',
    };

    document.querySelectorAll('.quick-access-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = actions[btn.dataset.action];
            if (targetId) document.getElementById(targetId)?.click();
        });
    });
}

/* ================================================================
   9. Daily motivational quote
   ================================================================ */

const QUOTES = [
    { tr: { text: 'Başarı, her gün tekrarlanan küçük çabaların toplamıdır.',                                author: 'Robert Collier'        }, en: { text: 'Success is the sum of small efforts, repeated day in and day out.',                          author: 'Robert Collier'        } },
    { tr: { text: 'Zor olan her şey, alışkanlık haline gelmeden önce zordur.',                              author: 'Johann W. von Goethe'  }, en: { text: 'Everything is difficult before it becomes a habit.',                                          author: 'Johann W. von Goethe'  } },
    { tr: { text: 'Bugün yapabileceğini yarına bırakma.',                                                   author: 'Benjamin Franklin'     }, en: { text: 'Never leave for tomorrow what you can do today.',                                             author: 'Benjamin Franklin'     } },
    { tr: { text: 'Başarının sırrı, başlamaktır.',                                                          author: 'Mark Twain'            }, en: { text: 'The secret of getting ahead is getting started.',                                             author: 'Mark Twain'            } },
    { tr: { text: 'Bir insanın yapabileceklerinin sınırı, hayal edebilecekleriyle doğru orantılıdır.',      author: 'Albert Einstein'       }, en: { text: 'The limit of what a person can achieve is directly proportional to what they can imagine.',  author: 'Albert Einstein'       } },
    { tr: { text: 'Düşmek başarısızlık değildir; düştükten sonra olduğun yerde kalmak başarısızlıktır.',    author: 'Mary Pickford'         }, en: { text: 'Failure is not falling down; failure is staying down after you fall.',                       author: 'Mary Pickford'         } },
    { tr: { text: 'Çalışmak, en güvenilir şans kaynağıdır.',                                               author: 'Thomas Jefferson'      }, en: { text: 'Work is the most reliable source of luck.',                                                   author: 'Thomas Jefferson'      } },
    { tr: { text: 'İnsanlar neden hedeflerine ulaşamaz? Çünkü onları hayal etmekle yetinirler.',            author: 'Paulo Coelho'          }, en: { text: 'Why do people never achieve their goals? Because they settle for merely dreaming them.',      author: 'Paulo Coelho'          } },
    { tr: { text: 'Bugün acı çekerek çalışmak, yarın zaferle gülmek demektir.',                             author: 'Mustafa Kemal Atatürk' }, en: { text: 'Working through hardship today means smiling in victory tomorrow.',                          author: 'Mustafa Kemal Atatürk' } },
    { tr: { text: 'Azim, yeteneği her zaman yener.',                                                        author: 'Arthur Schopenhauer'   }, en: { text: 'Perseverance always triumphs over talent.',                                                   author: 'Arthur Schopenhauer'   } },
    { tr: { text: 'Başarı bir yolculuktur, varış noktası değil.',                                           author: 'Arthur Ashe'           }, en: { text: 'Success is a journey, not a destination.',                                                    author: 'Arthur Ashe'           } },
    { tr: { text: 'Büyük işler, büyük emeklerle yapılır.',                                                  author: 'Aristoteles'           }, en: { text: 'Great things are achieved through great effort.',                                            author: 'Aristotle'             } },
    { tr: { text: 'Kendine inan; bütün yarı kazanılmış demektir.',                                          author: 'Theodore Roosevelt'    }, en: { text: 'Believe in yourself; that alone is half the battle won.',                                     author: 'Theodore Roosevelt'    } },
    { tr: { text: 'Hiçbir şey çalışmak kadar güçlü bir teselli veremez.',                                  author: 'Anne Frank'            }, en: { text: 'Nothing can comfort you as powerfully as work.',                                              author: 'Anne Frank'            } },
    { tr: { text: 'Gelecek, hayallerinin güzelliğine inananlarındır.',                                      author: 'Eleanor Roosevelt'     }, en: { text: 'The future belongs to those who believe in the beauty of their dreams.',                      author: 'Eleanor Roosevelt'     } },
    { tr: { text: 'Yolun ne kadar uzun olduğu önemli değil, önemli olan doğru yönde ilerlemektir.',         author: 'Konfüçyüs'             }, en: { text: 'It does not matter how long the road is, what matters is moving in the right direction.',    author: 'Confucius'             } },
    { tr: { text: 'Bir şeyi yapabileceğini düşünüyorsan haklısın, yapamayacağını düşünüyorsan da haklısın.', author: 'Henry Ford'            }, en: { text: "Whether you think you can, or you think you can't, you're right.",                            author: 'Henry Ford'            } },
    { tr: { text: 'Hayallerinin peşinden git, onlar sana yolu gösterecektir.',                              author: 'Walt Disney'           }, en: { text: 'Follow your dreams, they will show you the way.',                                             author: 'Walt Disney'           } },
    { tr: { text: 'Zorluklar, seni pes ettirmek için değil, güçlendirmek için vardır.',                     author: 'Nelson Mandela'        }, en: { text: 'Difficulties exist not to make you give up, but to make you stronger.',                       author: 'Nelson Mandela'        } },
    { tr: { text: 'Disiplin, hedeflerinle motivasyonun arasındaki köprüdür.',                               author: 'Jim Rohn'              }, en: { text: 'Discipline is the bridge between goals and accomplishment.',                                  author: 'Jim Rohn'              } },
    { tr: { text: 'Kazananlar asla vazgeçmez, vazgeçenler asla kazanamaz.',                                 author: 'Vince Lombardi'        }, en: { text: 'Winners never quit, and quitters never win.',                                                 author: 'Vince Lombardi'        } },
    { tr: { text: 'Çalışkanlık, şansın anasıdır.',                                                          author: 'Miguel de Cervantes'   }, en: { text: 'Diligence is the mother of good fortune.',                                                    author: 'Miguel de Cervantes'   } },
    { tr: { text: 'Bugünün işini yarına bırakırsan, yarının işi bugünkünün iki katı olur.',                 author: 'Anonim'                }, en: { text: "If you put off today's work until tomorrow, tomorrow's work will be twice as much.",         author: 'Anonymous'             } },
    { tr: { text: 'Sabır acıdır ama meyvesi tatlıdır.',                                                     author: 'Jean-Jacques Rousseau' }, en: { text: 'Patience is bitter, but its fruit is sweet.',                                                 author: 'Jean-Jacques Rousseau' } },
    { tr: { text: 'Başarmak istiyorsan, önce başlamalısın.',                                                author: 'Pele'                  }, en: { text: 'If you want to succeed, you must start first.',                                              author: 'Pele'                  } },
];

function initDailyQuote() {
    const textEl   = document.getElementById('quoteText');
    const authorEl = document.getElementById('quoteAuthor');
    if (!textEl || !authorEl) return;

    // Pick a quote by day-of-year so it's stable all day and advances at midnight.
    const now         = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear   = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
    const quoteSet    = QUOTES[dayOfYear % QUOTES.length];

    const render = () => {
        const quote = quoteSet[getLang()] || quoteSet.tr;
        textEl.textContent   = quote.text;
        authorEl.textContent = '— ' + quote.author;
    };
    render();
    document.addEventListener('surecyks:langchange', render);
}

/* ================================================================
   10. User menu dropdown
   ================================================================ */

function initUserMenu(user) {
    user = user || { firstName: '', lastName: '', email: '' };

    const initials = [user.firstName, user.lastName]
        .map(n => n?.charAt(0).toUpperCase())
        .filter(Boolean)
        .join('') || 'AY';

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || t('dropdown.defaultUser');

    // Update nav avatar button
    const navAvatar = document.getElementById('userMenuBtn');
    if (navAvatar) navAvatar.textContent = initials;

    // Update hero greeting
    const heroH1 = document.querySelector('.dash-hero h1');
    const updateGreeting = () => {
        if (!heroH1) return;
        heroH1.textContent = user.firstName
            ? t('hero.greeting', { name: user.firstName })
            : t('hero.greetingFallback');
    };
    updateGreeting();
    document.addEventListener('surecyks:langchange', updateGreeting);

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
                fetch('/api/logout', { method: 'POST' }).finally(() => {
                    window.location.href = 'index.html';
                });
            } else if (action === 'profile') {
                window.location.href = 'profile.html';
            }
            closeMenu();
        });
    });
}