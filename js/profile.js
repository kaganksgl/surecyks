// profile.js — account info, password change, and preferences page

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    document.getElementById('profileFirstName').value = user.firstName || '';
    document.getElementById('profileLastName').value = user.lastName || '';
    document.getElementById('profileEmail').value = user.email || '';

    const memberSinceEl = document.getElementById('profileMemberSince');
    const updateMemberSince = () => {
        if (!memberSinceEl || !user.createdAt) return;
        const date = new Date(user.createdAt.replace(' ', 'T') + 'Z');
        const formatted = isNaN(date) ? user.createdAt : date.toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'tr-TR');
        memberSinceEl.textContent = t('profile.memberSince', { date: formatted });
    };
    updateMemberSince();
    document.addEventListener('surecyks:langchange', updateMemberSince);

    initProfileForm();
    initPasswordForm();
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

function showMessage(el, message, isError) {
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle('form-message--error', Boolean(isError));
    el.classList.toggle('form-message--success', !isError);
}

function initProfileForm() {
    const form = document.getElementById('profileForm');
    const message = document.getElementById('profileMessage');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const firstName = document.getElementById('profileFirstName').value.trim();
        const lastName = document.getElementById('profileLastName').value.trim();

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName }),
            });
            const data = await response.json();

            if (!response.ok) {
                showMessage(message, data.error || t('auth.connectionError'), true);
                return;
            }

            showMessage(message, t('profile.profileUpdated'), false);
        } catch (err) {
            showMessage(message, t('auth.connectionError'), true);
        }
    });
}

function initPasswordForm() {
    const form = document.getElementById('passwordForm');
    const message = document.getElementById('passwordMessage');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        try {
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
            });
            const data = await response.json();

            if (!response.ok) {
                showMessage(message, data.error || t('auth.connectionError'), true);
                return;
            }

            form.reset();
            showMessage(message, t('profile.passwordUpdated'), false);
        } catch (err) {
            showMessage(message, t('auth.connectionError'), true);
        }
    });
}
