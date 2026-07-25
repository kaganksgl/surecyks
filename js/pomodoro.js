// pomodoro.js — 25/5 (classic Pomodoro Technique) study timer.

const SETTINGS_STORAGE_KEY = 'surecYksPomodoroSettings';
const TODAY_STORAGE_KEY = 'surecYksPomodoroToday';

const DEFAULT_SETTINGS = { work: 25, shortBreak: 5, longBreak: 15, rounds: 4 };

const MODE_COLOR_VAR = { work: '--violet', short: '--teal', long: '--amber' };
const MODE_LABEL_KEY = { work: 'pomodoro.modeWork', short: 'pomodoro.modeShortBreak', long: 'pomodoro.modeLongBreak' };

let settings = loadSettings();
let state = {
    mode: 'work',
    remainingSeconds: settings.work * 60,
    totalSeconds: settings.work * 60,
    round: 1,          // work sessions completed in the current cycle (1-based, resets after a long break)
    isRunning: false,
    intervalId: null,
};

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    populateSettingsForm();
    renderCompletedToday();
    renderAll();

    document.getElementById('pomodoroStartPause').addEventListener('click', toggleRunning);
    document.getElementById('pomodoroSkip').addEventListener('click', () => advancePhase(false));
    document.getElementById('pomodoroReset').addEventListener('click', resetCurrentPhase);
    document.getElementById('pomodoroSettingsForm').addEventListener('submit', onSettingsSubmit);

    document.addEventListener('surecyks:langchange', renderAll);
    window.addEventListener('beforeunload', () => { document.title = 'Pomodoro | Süreç YKS'; });
});

async function requireAuth() {
    try {
        const response = await fetch('/api/me');
        if (!response.ok) {
            window.location.href = 'index.html';
            return null;
        }
        return (await response.json()).user;
    } catch (err) {
        window.location.href = 'index.html';
        return null;
    }
}

/* ================================================================
   Settings
   ================================================================ */

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); }
    catch { /* quota / private mode */ }
}

function populateSettingsForm() {
    document.getElementById('settingWork').value = settings.work;
    document.getElementById('settingShortBreak').value = settings.shortBreak;
    document.getElementById('settingLongBreak').value = settings.longBreak;
    document.getElementById('settingRounds').value = settings.rounds;
}

function onSettingsSubmit(e) {
    e.preventDefault();

    const work = parseInt(document.getElementById('settingWork').value, 10);
    const shortBreak = parseInt(document.getElementById('settingShortBreak').value, 10);
    const longBreak = parseInt(document.getElementById('settingLongBreak').value, 10);
    const rounds = parseInt(document.getElementById('settingRounds').value, 10);

    if (!(work > 0 && shortBreak > 0 && longBreak > 0 && rounds > 0)) return;

    settings = { work, shortBreak, longBreak, rounds };
    saveSettings();

    // Applying settings restarts the session cleanly from a fresh work phase.
    stopInterval();
    state = { mode: 'work', remainingSeconds: settings.work * 60, totalSeconds: settings.work * 60, round: 1, isRunning: false, intervalId: null };
    renderAll();
}

/* ================================================================
   Today's completed-pomodoro counter (date-scoped, like the streak)
   ================================================================ */

function dateStr(date) {
    return date.toLocaleDateString('en-CA');
}

function getCompletedToday() {
    try {
        const raw = localStorage.getItem(TODAY_STORAGE_KEY);
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        return parsed.date === dateStr(new Date()) ? (parsed.count || 0) : 0;
    } catch {
        return 0;
    }
}

function incrementCompletedToday() {
    const count = getCompletedToday() + 1;
    try { localStorage.setItem(TODAY_STORAGE_KEY, JSON.stringify({ date: dateStr(new Date()), count })); }
    catch { /* quota / private mode */ }
    renderCompletedToday();
}

function renderCompletedToday() {
    const el = document.getElementById('pomodoroCompletedToday');
    if (el) el.textContent = String(getCompletedToday());
}

/* ================================================================
   Timer engine
   ================================================================ */

function durationFor(mode) {
    if (mode === 'work') return settings.work * 60;
    if (mode === 'short') return settings.shortBreak * 60;
    return settings.longBreak * 60;
}

function toggleRunning() {
    state.isRunning ? pause() : start();
}

function start() {
    if (state.isRunning) return;
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    state.isRunning = true;
    state.intervalId = setInterval(tick, 1000);
    renderAll();
}

function pause() {
    state.isRunning = false;
    stopInterval();
    renderAll();
}

function stopInterval() {
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = null;
}

function tick() {
    state.remainingSeconds -= 1;
    if (state.remainingSeconds <= 0) {
        advancePhase(true);
    } else {
        renderTimer();
        renderRing();
        updateDocumentTitle();
    }
}

function advancePhase(completedNaturally) {
    stopInterval();

    const wasWork = state.mode === 'work';
    if (wasWork && completedNaturally) incrementCompletedToday();

    let nextMode;
    let nextRound = state.round;
    if (wasWork) {
        nextMode = state.round >= settings.rounds ? 'long' : 'short';
    } else {
        nextMode = 'work';
        nextRound = state.mode === 'long' ? 1 : state.round + 1;
    }

    if (completedNaturally) notifyPhaseChange(wasWork);

    state.mode = nextMode;
    state.round = nextRound;
    state.remainingSeconds = durationFor(nextMode);
    state.totalSeconds = state.remainingSeconds;

    if (state.isRunning) {
        state.intervalId = setInterval(tick, 1000);
    }
    renderAll();
}

function resetCurrentPhase() {
    stopInterval();
    state.isRunning = false;
    state.remainingSeconds = durationFor(state.mode);
    state.totalSeconds = state.remainingSeconds;
    renderAll();
}

/* ================================================================
   Notifications / sound
   ================================================================ */

function notifyPhaseChange(wasWork) {
    playBeep();
    const messageKey = wasWork ? 'pomodoro.notifyWorkDone' : 'pomodoro.notifyBreakDone';
    if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(t('pomodoro.title'), { body: t(messageKey) }); }
        catch { /* not supported in this context */ }
    }
}

function playBeep() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch {
        /* Web Audio unsupported */
    }
}

/* ================================================================
   Rendering
   ================================================================ */

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderTimer() {
    document.getElementById('pomodoroTimer').textContent = formatTime(Math.max(0, state.remainingSeconds));
}

function renderModeBadge() {
    const el = document.getElementById('pomodoroModeBadge');
    if (el) el.textContent = t(MODE_LABEL_KEY[state.mode]);
}

function renderRound() {
    const el = document.getElementById('pomodoroRound');
    if (el) el.textContent = t('pomodoro.round', { current: state.round, total: settings.rounds });
}

function renderRing() {
    const ring = document.getElementById('pomodoroRing');
    if (!ring) return;
    const pct = state.totalSeconds ? Math.max(0, Math.min(100, (state.remainingSeconds / state.totalSeconds) * 100)) : 0;
    const colorVarName = MODE_COLOR_VAR[state.mode];
    const color = getComputedStyle(document.documentElement).getPropertyValue(colorVarName).trim();
    ring.style.setProperty('--progress', pct);
    ring.style.setProperty('--ring-color', color || 'var(--accent)');
}

function renderControls() {
    const btn = document.getElementById('pomodoroStartPause');
    if (btn) btn.textContent = t(state.isRunning ? 'pomodoro.pause' : 'pomodoro.start');
}

function updateDocumentTitle() {
    if (!state.isRunning) return;
    document.title = `${formatTime(state.remainingSeconds)} · ${t(MODE_LABEL_KEY[state.mode])} | Süreç YKS`;
}

function renderAll() {
    renderTimer();
    renderModeBadge();
    renderRound();
    renderRing();
    renderControls();
    updateDocumentTitle();
    if (!state.isRunning) document.title = 'Pomodoro | Süreç YKS';
}
