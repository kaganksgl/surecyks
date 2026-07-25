// theme.js — shared dark/light theme handling across all pages.
// A blocking inline script in each page's <head> already applies the
// resolved theme attribute before first paint (see anti-flash snippet in
// each HTML file); this file wires up interactive toggles/selects.

const THEME_STORAGE_KEY = 'surecYksTheme'; // stored value: 'light' | 'dark' | 'system'

function getStoredTheme() {
    try { return localStorage.getItem(THEME_STORAGE_KEY) || 'system'; }
    catch { return 'system'; }
}

function resolveTheme(pref) {
    if (pref === 'dark' || pref === 'light') return pref;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}

function applyTheme(pref) {
    const resolved = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', resolved);

    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(resolved === 'dark'));
        btn.textContent = resolved === 'dark' ? '☀️' : '🌙';
    });
    document.querySelectorAll('[data-theme-select]').forEach(select => {
        select.value = pref;
    });
}

function setTheme(pref) {
    try { localStorage.setItem(THEME_STORAGE_KEY, pref); } catch { /* quota / private mode */ }
    applyTheme(pref);
}

function initThemeControls() {
    applyTheme(getStoredTheme());

    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const current = resolveTheme(getStoredTheme());
            setTheme(current === 'dark' ? 'light' : 'dark');
        });
    });

    document.querySelectorAll('[data-theme-select]').forEach(select => {
        select.addEventListener('change', () => setTheme(select.value));
    });

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (getStoredTheme() === 'system') applyTheme('system');
        });
    }
}

document.addEventListener('DOMContentLoaded', initThemeControls);
