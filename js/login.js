const loginForm = document.querySelector("form");

loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData(loginForm);

    const email = formData.get('email');
    const password = formData.get('password');
    const remember = formData.get('remember') === 'on';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, remember }),
        });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || t('auth.loginFailed'));
            return;
        }

        window.location.href = "main.html";
    } catch (err) {
        alert(t('auth.connectionError'));
    }
});
