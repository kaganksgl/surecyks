// i18n.js — shared TR/EN language switching across all pages.
//
// Scope decision: curriculum-specific proper nouns (TYT/AYT/YDT, subject
// names like Matematik/Fizik, track names like Sayısal/Sözel, and the daily
// motivational quotes) are intentionally left in Turkish in every language —
// a Turkish exam-prep student wants those unchanged regardless of UI
// language. Only interface chrome (nav, buttons, labels, empty states) is
// translated.

const LANG_STORAGE_KEY = 'surecYksLang'; // 'tr' | 'en'
const DEFAULT_LANG = 'tr';

const TRANSLATIONS = {
    tr: {
        'auth.welcomeBack': 'Tekrar hoş geldin.',
        'auth.welcomeAboard': 'Aramıza hoş geldin.',
        'auth.emailPlaceholder': 'Email Adresiniz',
        'auth.passwordPlaceholder': 'Şifreniz',
        'auth.confirmPasswordPlaceholder': 'Şifrenizi Doğrulayın',
        'auth.firstNamePlaceholder': 'Adınız',
        'auth.lastNamePlaceholder': 'Soyadınız',
        'auth.rememberMe': 'Beni hatırla',
        'auth.login': 'Giriş Yap',
        'auth.signup': 'Kayıt Ol',
        'auth.noAccount': 'Hesabın Yok Mu?',
        'auth.hasAccount': 'Zaten Hesabın Var Mı?',
        'auth.passwordMismatch': 'Şifreler eşleşmiyor! Lütfen tekrar kontrol edin.',
        'auth.connectionError': 'Sunucuya bağlanılamadı.',
        'auth.signupSuccess': 'Kayıt başarılı! Panele yönlendiriliyorsunuz.',
        'auth.loginFailed': 'Giriş başarısız oldu.',
        'auth.signupFailed': 'Kayıt başarısız oldu.',

        'nav.panel': 'Panel',
        'nav.plan': 'Çalışma Planı',
        'nav.denemeler': 'Denemeler',

        'dropdown.theme': 'Tema',
        'dropdown.language': 'Dil',
        'dropdown.profile': 'Profili Düzenle',
        'dropdown.logout': 'Çıkış Yap',
        'dropdown.defaultUser': 'Kullanıcı',
        'dropdown.streakCalculating': 'Seri hesaplanıyor…',

        'hero.greeting': 'Tekrar hoş geldin, {name}.',
        'hero.greetingFallback': 'Tekrar hoş geldin.',
        'hero.noTasks': 'Bugün için henüz görev eklenmedi. Hadi ekleyelim!',
        'hero.allDone': 'Bugünün tüm görevlerini tamamladın. Harika iş!',
        'hero.oneTask': 'Bugün 1 görev seni bekliyor. Hadi başlayalım.',
        'hero.manyTasks': 'Bugün {n} görev seni bekliyor. Hadi başlayalım.',
        'hero.streak': '{n} günlük seri',
        'streak.milestone': '{n} Günlük Seri',
        'hero.pomodoroButton': 'Pomodoro',

        'stats.solvedToday': 'Bugün Çözülen Soru',

        'plan.title': 'Bugünün Planı',
        'plan.newTask': 'Yeni Görev',
        'plan.empty': 'Bugün için henüz görev eklenmedi.',
        'plan.done': 'tamamlandı',
        'plan.questionCount': '{n} soru',
        'plan.deleteTask': 'Görevi sil',

        'deneme.latestTitle': 'Son Deneme Sonuçların',
        'deneme.newDeneme': 'Yeni Deneme',
        'deneme.seeHistory': 'Geçmişi gör',
        'deneme.empty': 'Henüz deneme sonucu girilmedi.',
        'deneme.totalNet': 'toplam net',
        'deneme.netSuffix': 'net',
        'deneme.correctAbbr': 'D',
        'deneme.wrongAbbr': 'Y',
        'deneme.chartTitle': 'Net Takibi',
        'deneme.chartEmpty': 'Grafiği görmek için en az bir deneme sonucu gir.',
        'deneme.historyTitle': 'Deneme Geçmişi',
        'deneme.historyEmpty': 'Henüz deneme kaydı yok.',
        'deneme.colDate': 'Tarih',
        'deneme.colExamType': 'Sınav Türü',
        'deneme.colDetail': 'Detay',
        'deneme.colTotalNet': 'Toplam Net',
        'deneme.deleteEntry': 'Deneme kaydını sil',

        'countdown.title': "YKS'ye Kalan Süre",
        'countdown.unit': 'gün',
        'countdown.examDate': 'Sınav tarihi: {date}',

        'quickAccess.title': 'Hızlı Erişim',
        'quickAccess.newTask': 'Yeni görev ekle',
        'quickAccess.newDeneme': 'Yeni deneme gir',

        'modal.addTask.title': 'Yeni Görev Ekle',
        'modal.addTask.subject': 'Ders',
        'modal.addTask.subjectPlaceholder': 'Örn. Matematik',
        'modal.addTask.topic': 'Konu',
        'modal.addTask.topicPlaceholder': 'Örn. Türev Tekrarı',
        'modal.addTask.questionCount': 'Soru Sayısı',
        'modal.addTask.questionCountPlaceholder': 'Örn. 30',
        'modal.addTask.color': 'Renk',
        'modal.addTask.submit': 'Görevi Ekle',

        'modal.addDeneme.title': 'Yeni Deneme Ekle',
        'modal.addDeneme.date': 'Tarih',
        'modal.addDeneme.examType': 'Sınav Türü',
        'modal.addDeneme.select': 'Seçiniz',
        'modal.addDeneme.field': 'Alan',
        'modal.addDeneme.submit': 'Sonucu Kaydet',
        'modal.addDeneme.correct': 'Doğru',
        'modal.addDeneme.wrong': 'Yanlış',
        'modal.addDeneme.questionsSuffix': '{n} soru',
        'modal.addDeneme.validation': '{subject} toplam {max} sorudan oluşur; doğru + yanlış toplamı bunu geçemez.',

        'profile.title': 'Profil',
        'profile.backToDashboard': 'Panele Dön',
        'profile.accountInfo': 'Hesap Bilgileri',
        'profile.firstName': 'Ad',
        'profile.lastName': 'Soyad',
        'profile.email': 'Email',
        'profile.saveChanges': 'Değişiklikleri Kaydet',
        'profile.changePassword': 'Şifre Değiştir',
        'profile.currentPassword': 'Mevcut Şifre',
        'profile.newPassword': 'Yeni Şifre',
        'profile.confirmNewPassword': 'Yeni Şifreyi Doğrula',
        'profile.updatePassword': 'Şifreyi Güncelle',
        'profile.preferences': 'Tercihler',
        'profile.language': 'Dil',
        'profile.theme': 'Görünüm',
        'profile.themeLight': 'Açık',
        'profile.themeDark': 'Koyu',
        'profile.themeSystem': 'Sistem',
        'profile.profileUpdated': 'Profil güncellendi.',
        'profile.passwordUpdated': 'Şifre güncellendi.',
        'profile.memberSince': 'Katılım: {date}',

        'pomodoro.title': 'Pomodoro Zamanlayıcı',
        'pomodoro.subtitle': '25 dakika odaklan, 5 dakika dinlen.',
        'pomodoro.backToDashboard': 'Panele Dön',
        'pomodoro.modeWork': 'Odaklanma',
        'pomodoro.modeShortBreak': 'Kısa Mola',
        'pomodoro.modeLongBreak': 'Uzun Mola',
        'pomodoro.round': '{current}. Pomodoro / {total}',
        'pomodoro.start': 'Başlat',
        'pomodoro.pause': 'Duraklat',
        'pomodoro.reset': 'Sıfırla',
        'pomodoro.skip': 'Atla',
        'pomodoro.settingsTitle': 'Ayarlar',
        'pomodoro.settingsWork': 'Odaklanma (dk)',
        'pomodoro.settingsShortBreak': 'Kısa Mola (dk)',
        'pomodoro.settingsLongBreak': 'Uzun Mola (dk)',
        'pomodoro.settingsRounds': 'Uzun Moladan Önceki Tur Sayısı',
        'pomodoro.settingsApply': 'Ayarları Uygula',
        'pomodoro.completedTitle': 'Bugün Tamamlanan Pomodoro',
        'pomodoro.notifyWorkDone': 'Odaklanma süresi bitti! Mola zamanı.',
        'pomodoro.notifyBreakDone': 'Mola bitti! Odaklanma zamanı.',
    },
    en: {
        'auth.welcomeBack': 'Welcome back.',
        'auth.welcomeAboard': 'Welcome aboard.',
        'auth.emailPlaceholder': 'Your Email',
        'auth.passwordPlaceholder': 'Your Password',
        'auth.confirmPasswordPlaceholder': 'Confirm Password',
        'auth.firstNamePlaceholder': 'First Name',
        'auth.lastNamePlaceholder': 'Last Name',
        'auth.rememberMe': 'Remember me',
        'auth.login': 'Log In',
        'auth.signup': 'Sign Up',
        'auth.noAccount': "Don't have an account?",
        'auth.hasAccount': 'Already have an account?',
        'auth.passwordMismatch': "Passwords don't match! Please check again.",
        'auth.connectionError': 'Could not connect to the server.',
        'auth.signupSuccess': 'Signup successful! Redirecting you to the dashboard.',
        'auth.loginFailed': 'Login failed.',
        'auth.signupFailed': 'Signup failed.',

        'nav.panel': 'Dashboard',
        'nav.plan': 'Study Plan',
        'nav.denemeler': 'Mock Exams',

        'dropdown.theme': 'Theme',
        'dropdown.language': 'Language',
        'dropdown.profile': 'Edit Profile',
        'dropdown.logout': 'Log Out',
        'dropdown.defaultUser': 'User',
        'dropdown.streakCalculating': 'Calculating streak…',

        'hero.greeting': 'Welcome back, {name}.',
        'hero.greetingFallback': 'Welcome back.',
        'hero.noTasks': "No tasks added for today yet. Let's add one!",
        'hero.allDone': "You've completed all of today's tasks. Great job!",
        'hero.oneTask': '1 task is waiting for you today. Let\'s get started.',
        'hero.manyTasks': '{n} tasks are waiting for you today. Let\'s get started.',
        'hero.streak': '{n} day streak',
        'streak.milestone': '{n}-Day Streak',
        'hero.pomodoroButton': 'Pomodoro',

        'stats.solvedToday': 'Questions Solved Today',

        'plan.title': "Today's Plan",
        'plan.newTask': 'New Task',
        'plan.empty': 'No tasks added for today yet.',
        'plan.done': 'done',
        'plan.questionCount': '{n} questions',
        'plan.deleteTask': 'Delete task',

        'deneme.latestTitle': 'Your Latest Mock Results',
        'deneme.newDeneme': 'New Mock Exam',
        'deneme.seeHistory': 'See history',
        'deneme.empty': 'No mock exam results yet.',
        'deneme.totalNet': 'total score',
        'deneme.netSuffix': 'score',
        'deneme.correctAbbr': 'C',
        'deneme.wrongAbbr': 'W',
        'deneme.chartTitle': 'Score Tracking',
        'deneme.chartEmpty': 'Enter at least one mock exam result to see the chart.',
        'deneme.historyTitle': 'Mock Exam History',
        'deneme.historyEmpty': 'No mock exam records yet.',
        'deneme.colDate': 'Date',
        'deneme.colExamType': 'Exam Type',
        'deneme.colDetail': 'Detail',
        'deneme.colTotalNet': 'Total Score',
        'deneme.deleteEntry': 'Delete mock exam record',

        'countdown.title': 'Time Left Until YKS',
        'countdown.unit': 'days',
        'countdown.examDate': 'Exam date: {date}',

        'quickAccess.title': 'Quick Access',
        'quickAccess.newTask': 'Add new task',
        'quickAccess.newDeneme': 'Enter new mock exam',

        'modal.addTask.title': 'Add New Task',
        'modal.addTask.subject': 'Subject',
        'modal.addTask.subjectPlaceholder': 'e.g. Math',
        'modal.addTask.topic': 'Topic',
        'modal.addTask.topicPlaceholder': 'e.g. Derivative Review',
        'modal.addTask.questionCount': 'Number of Questions',
        'modal.addTask.questionCountPlaceholder': 'e.g. 30',
        'modal.addTask.color': 'Color',
        'modal.addTask.submit': 'Add Task',

        'modal.addDeneme.title': 'Add New Mock Exam',
        'modal.addDeneme.date': 'Date',
        'modal.addDeneme.examType': 'Exam Type',
        'modal.addDeneme.select': 'Select',
        'modal.addDeneme.field': 'Field',
        'modal.addDeneme.submit': 'Save Result',
        'modal.addDeneme.correct': 'Correct',
        'modal.addDeneme.wrong': 'Wrong',
        'modal.addDeneme.questionsSuffix': '{n} questions',
        'modal.addDeneme.validation': '{subject} has {max} questions total; correct + wrong cannot exceed that.',

        'profile.title': 'Profile',
        'profile.backToDashboard': 'Back to Dashboard',
        'profile.accountInfo': 'Account Information',
        'profile.firstName': 'First Name',
        'profile.lastName': 'Last Name',
        'profile.email': 'Email',
        'profile.saveChanges': 'Save Changes',
        'profile.changePassword': 'Change Password',
        'profile.currentPassword': 'Current Password',
        'profile.newPassword': 'New Password',
        'profile.confirmNewPassword': 'Confirm New Password',
        'profile.updatePassword': 'Update Password',
        'profile.preferences': 'Preferences',
        'profile.language': 'Language',
        'profile.theme': 'Appearance',
        'profile.themeLight': 'Light',
        'profile.themeDark': 'Dark',
        'profile.themeSystem': 'System',
        'profile.profileUpdated': 'Profile updated.',
        'profile.passwordUpdated': 'Password updated.',
        'profile.memberSince': 'Member since {date}',

        'pomodoro.title': 'Pomodoro Timer',
        'pomodoro.subtitle': 'Focus for 25 minutes, rest for 5.',
        'pomodoro.backToDashboard': 'Back to Dashboard',
        'pomodoro.modeWork': 'Focus',
        'pomodoro.modeShortBreak': 'Short Break',
        'pomodoro.modeLongBreak': 'Long Break',
        'pomodoro.round': 'Pomodoro {current} / {total}',
        'pomodoro.start': 'Start',
        'pomodoro.pause': 'Pause',
        'pomodoro.reset': 'Reset',
        'pomodoro.skip': 'Skip',
        'pomodoro.settingsTitle': 'Settings',
        'pomodoro.settingsWork': 'Focus (min)',
        'pomodoro.settingsShortBreak': 'Short Break (min)',
        'pomodoro.settingsLongBreak': 'Long Break (min)',
        'pomodoro.settingsRounds': 'Rounds Before Long Break',
        'pomodoro.settingsApply': 'Apply Settings',
        'pomodoro.completedTitle': 'Pomodoros Completed Today',
        'pomodoro.notifyWorkDone': 'Focus session done! Time for a break.',
        'pomodoro.notifyBreakDone': 'Break is over! Time to focus.',
    },
};

function getLang() {
    try {
        const stored = localStorage.getItem(LANG_STORAGE_KEY);
        if (stored && TRANSLATIONS[stored]) return stored;
    } catch { /* private mode */ }
    return DEFAULT_LANG;
}

function t(key, vars) {
    const dict = TRANSLATIONS[getLang()] || TRANSLATIONS[DEFAULT_LANG];
    let str = dict[key] ?? TRANSLATIONS[DEFAULT_LANG][key] ?? key;
    if (vars) {
        Object.keys(vars).forEach(k => { str = str.replace(`{${k}}`, vars[k]); });
    }
    return str;
}

function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });
    document.documentElement.lang = getLang();
}

function setLang(lang) {
    if (!TRANSLATIONS[lang]) return;
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* private mode */ }
    applyTranslations();
    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.langToggle === lang);
        btn.setAttribute('aria-pressed', String(btn.dataset.langToggle === lang));
    });
    document.querySelectorAll('[data-lang-select]').forEach(select => { select.value = lang; });
    document.dispatchEvent(new CustomEvent('surecyks:langchange', { detail: { lang } }));
}

function initLangControls() {
    applyTranslations();

    const current = getLang();
    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.langToggle === current);
        btn.setAttribute('aria-pressed', String(btn.dataset.langToggle === current));
        btn.addEventListener('click', () => setLang(btn.dataset.langToggle));
    });
    document.querySelectorAll('[data-lang-select]').forEach(select => {
        select.value = current;
        select.addEventListener('change', () => setLang(select.value));
    });
}

document.addEventListener('DOMContentLoaded', () => initLangControls());
