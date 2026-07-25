const signupform = document.querySelector("form");

signupform.addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData(signupform);

    const firstName = formData.get('fname');
    const lastName = formData.get('lname');
    const email = formData.get('email');
    const password = formData.get('password');
    const confPassword = formData.get('confpassword');

    if (password !== confPassword) {
        alert(t('auth.passwordMismatch'));
        return;
    }

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password, confPassword }),
        });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || t('auth.signupFailed'));
            return;
        }

        alert(t('auth.signupSuccess'));
        window.location.href = "main.html";
    } catch (err) {
        alert(t('auth.connectionError'));
    }
});
