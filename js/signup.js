const signupform = document.querySelector("form");

signupform.addEventListener('submit', function(event) {
    event.preventDefault();
    const formData = new FormData(signupform);

    const firstName = formData.get('fname');
    const lastName = formData.get('lname');
    const email = formData.get('email');
    const password = formData.get('password');
    const confPassword = formData.get('confpassword');

    if (password !== confPassword) {
        alert("Şifreler eşleşmiyor! Lütfen tekrar kontrol edin.");
        return;
    }

    const userData = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password 
    };
    
    localStorage.setItem('registeredUser', JSON.stringify(userData));

    console.log("Veri localStorage'a kaydedildi:", userData);
    
    alert("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz.");
    window.location.href = "index.html";
});
//note for the next dev: pls dont use localstorage, it ruins everything.
