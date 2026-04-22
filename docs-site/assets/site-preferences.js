(function () {
  const SUPPORTED_LOCALES = [
    "en", "fr", "sw", "zh", "ja", "th", "ar", "hi", "es", "pt", "de", "ko", "ms", "ta"
  ];

  const LOCALE_LABELS = {
    en: "English",
    fr: "Français",
    sw: "Swahili",
    zh: "中文",
    ja: "日本語",
    th: "ไทย",
    ar: "العربية",
    hi: "हिन्दी",
    es: "Español",
    pt: "Português",
    de: "Deutsch",
    ko: "한국어",
    ms: "Bahasa Melayu",
    ta: "தமிழ்",
  };

  const LOCALE_FLAGS = {
    en: "🌍",
    fr: "🇫🇷",
    sw: "🇰🇪",
    zh: "🇨🇳",
    ja: "🇯🇵",
    th: "🇹🇭",
    ar: "🇸🇦",
    hi: "🇮🇳",
    es: "🇪🇸",
    pt: "🇵🇹",
    de: "🇩🇪",
    ko: "🇰🇷",
    ms: "🇲🇾",
    ta: "🇸🇬",
  };

  const TEXT = {
    signup: {
      en: {
        title: "Create account — Cyrptonvest",
        heading: "Create account",
        email: "Email",
        password: "Password",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "Min 8 characters",
        submit: "Create account",
        submitting: "Creating…",
        loginLink: "I have an account",
        signupFailed: "Signup failed",
      },
      fr: {
        title: "Créer un compte — Cyrptonvest",
        heading: "Créer un compte",
        email: "E-mail",
        password: "Mot de passe",
        emailPlaceholder: "vous@exemple.com",
        passwordPlaceholder: "8 caractères min",
        submit: "Créer un compte",
        submitting: "Création…",
        loginLink: "J’ai déjà un compte",
        signupFailed: "Échec de l’inscription",
      },
      sw: {
        title: "Fungua akaunti — Cyrptonvest",
        heading: "Fungua akaunti",
        email: "Barua pepe",
        password: "Nenosiri",
        emailPlaceholder: "wewe@example.com",
        passwordPlaceholder: "Angalau herufi 8",
        submit: "Fungua akaunti",
        submitting: "Inafungua…",
        loginLink: "Nina akaunti tayari",
        signupFailed: "Usajili umeshindikana",
      },
      zh: {
        title: "创建账户 — Cyrptonvest",
        heading: "创建账户",
        email: "电子邮箱",
        password: "密码",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "至少 8 个字符",
        submit: "创建账户",
        submitting: "创建中…",
        loginLink: "我已有账户",
        signupFailed: "注册失败",
      },
      ja: {
        title: "アカウント作成 — Cyrptonvest",
        heading: "アカウントを作成",
        email: "メールアドレス",
        password: "パスワード",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "8文字以上",
        submit: "アカウント作成",
        submitting: "作成中…",
        loginLink: "すでにアカウントを持っています",
        signupFailed: "登録に失敗しました",
      },
      th: {
        title: "สร้างบัญชี — Cyrptonvest",
        heading: "สร้างบัญชี",
        email: "อีเมล",
        password: "รหัสผ่าน",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "อย่างน้อย 8 ตัวอักษร",
        submit: "สร้างบัญชี",
        submitting: "กำลังสร้าง…",
        loginLink: "ฉันมีบัญชีแล้ว",
        signupFailed: "สมัครไม่สำเร็จ",
      },
      ar: {
        title: "إنشاء حساب — Cyrptonvest",
        heading: "إنشاء حساب",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "8 أحرف على الأقل",
        submit: "إنشاء حساب",
        submitting: "جارٍ الإنشاء…",
        loginLink: "لدي حساب بالفعل",
        signupFailed: "فشل إنشاء الحساب",
      },
      hi: {
        title: "खाता बनाएं — Cyrptonvest",
        heading: "खाता बनाएं",
        email: "ईमेल",
        password: "पासवर्ड",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "कम से कम 8 अक्षर",
        submit: "खाता बनाएं",
        submitting: "बनाया जा रहा है…",
        loginLink: "मेरे पास पहले से खाता है",
        signupFailed: "साइनअप असफल रहा",
      },
      es: {
        title: "Crear cuenta — Cyrptonvest",
        heading: "Crear cuenta",
        email: "Correo",
        password: "Contraseña",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "Mínimo 8 caracteres",
        submit: "Crear cuenta",
        submitting: "Creando…",
        loginLink: "Ya tengo cuenta",
        signupFailed: "Registro fallido",
      },
      pt: {
        title: "Criar conta — Cyrptonvest",
        heading: "Criar conta",
        email: "E-mail",
        password: "Senha",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "Mínimo 8 caracteres",
        submit: "Criar conta",
        submitting: "Criando…",
        loginLink: "Já tenho conta",
        signupFailed: "Falha no cadastro",
      },
      de: {
        title: "Konto erstellen — Cyrptonvest",
        heading: "Konto erstellen",
        email: "E-Mail",
        password: "Passwort",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "Mindestens 8 Zeichen",
        submit: "Konto erstellen",
        submitting: "Wird erstellt…",
        loginLink: "Ich habe bereits ein Konto",
        signupFailed: "Registrierung fehlgeschlagen",
      },
      ko: {
        title: "계정 만들기 — Cyrptonvest",
        heading: "계정 만들기",
        email: "이메일",
        password: "비밀번호",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "최소 8자",
        submit: "계정 만들기",
        submitting: "생성 중…",
        loginLink: "이미 계정이 있습니다",
        signupFailed: "가입 실패",
      },
      ms: {
        title: "Cipta akaun — Cyrptonvest",
        heading: "Cipta akaun",
        email: "E-mel",
        password: "Kata laluan",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "Minimum 8 aksara",
        submit: "Cipta akaun",
        submitting: "Sedang dicipta…",
        loginLink: "Saya sudah ada akaun",
        signupFailed: "Pendaftaran gagal",
      },
      ta: {
        title: "கணக்கு உருவாக்கு — Cyrptonvest",
        heading: "கணக்கு உருவாக்கு",
        email: "மின்னஞ்சல்",
        password: "கடவுச்சொல்",
        emailPlaceholder: "you@example.com",
        passwordPlaceholder: "குறைந்தது 8 எழுத்துகள்",
        submit: "கணக்கு உருவாக்கு",
        submitting: "உருவாக்கப்படுகிறது…",
        loginLink: "எனக்கு ஏற்கனவே கணக்கு உள்ளது",
        signupFailed: "பதிவு தோல்வி",
      },
    },

    forgot: {
      en: {
        title: "Forgot Password — Cyrptonvest",
        heading: "Reset your password",
        sub: "Enter your account email and we’ll send a reset link.",
        email: "Email",
        emailPlaceholder: "you@example.com",
        submit: "Send reset link",
        submitting: "Sending…",
        back: "Back to Sign in",
        success: "If that account exists, a reset link has been sent.",
      },
      fr: {
        title: "Mot de passe oublié — Cyrptonvest",
        heading: "Réinitialisez votre mot de passe",
        sub: "Entrez votre e-mail et nous enverrons un lien de réinitialisation.",
        email: "E-mail",
        emailPlaceholder: "vous@exemple.com",
        submit: "Envoyer le lien",
        submitting: "Envoi…",
        back: "Retour à la connexion",
        success: "Si ce compte existe, un lien de réinitialisation a été envoyé.",
      },
      sw: {
        title: "Umesahau nenosiri — Cyrptonvest",
        heading: "Weka upya nenosiri lako",
        sub: "Weka barua pepe ya akaunti yako tutume kiungo cha kuweka upya.",
        email: "Barua pepe",
        emailPlaceholder: "wewe@example.com",
        submit: "Tuma kiungo",
        submitting: "Inatuma…",
        back: "Rudi kuingia",
        success: "Ikiwa akaunti hiyo ipo, kiungo cha kuweka upya kimetumwa.",
      },
      zh: {
        title: "忘记密码 — Cyrptonvest",
        heading: "重置您的密码",
        sub: "输入您的账户邮箱，我们会发送重置链接。",
        email: "电子邮箱",
        emailPlaceholder: "you@example.com",
        submit: "发送重置链接",
        submitting: "发送中…",
        back: "返回登录",
        success: "如果该账户存在，重置链接已发送。",
      },
      ja: {
        title: "パスワードを忘れた場合 — Cyrptonvest",
        heading: "パスワードをリセット",
        sub: "メールアドレスを入力すると、リセットリンクを送信します。",
        email: "メールアドレス",
        emailPlaceholder: "you@example.com",
        submit: "リセットリンクを送信",
        submitting: "送信中…",
        back: "ログインに戻る",
        success: "そのアカウントが存在する場合、リセットリンクを送信しました。",
      },
      th: {
        title: "ลืมรหัสผ่าน — Cyrptonvest",
        heading: "รีเซ็ตรหัสผ่าน",
        sub: "กรอกอีเมลบัญชีของคุณ แล้วเราจะส่งลิงก์รีเซ็ตให้",
        email: "อีเมล",
        emailPlaceholder: "you@example.com",
        submit: "ส่งลิงก์รีเซ็ต",
        submitting: "กำลังส่ง…",
        back: "กลับไปหน้าเข้าสู่ระบบ",
        success: "หากมีบัญชีนี้อยู่ เราได้ส่งลิงก์รีเซ็ตแล้ว",
      },
      ar: {
        title: "نسيت كلمة المرور — Cyrptonvest",
        heading: "إعادة تعيين كلمة المرور",
        sub: "أدخل بريد حسابك وسنرسل رابط إعادة التعيين.",
        email: "البريد الإلكتروني",
        emailPlaceholder: "you@example.com",
        submit: "إرسال الرابط",
        submitting: "جارٍ الإرسال…",
        back: "العودة لتسجيل الدخول",
        success: "إذا كان الحساب موجودًا، فقد تم إرسال رابط إعادة التعيين.",
      },
      hi: {
        title: "पासवर्ड भूल गए — Cyrptonvest",
        heading: "अपना पासवर्ड रीसेट करें",
        sub: "अपना ईमेल दर्ज करें, हम रीसेट लिंक भेजेंगे।",
        email: "ईमेल",
        emailPlaceholder: "you@example.com",
        submit: "रीसेट लिंक भेजें",
        submitting: "भेजा जा रहा है…",
        back: "साइन इन पर वापस जाएं",
        success: "यदि खाता मौजूद है, तो रीसेट लिंक भेज दिया गया है।",
      },
      es: {
        title: "Olvidé mi contraseña — Cyrptonvest",
        heading: "Restablece tu contraseña",
        sub: "Ingresa tu correo y enviaremos un enlace de restablecimiento.",
        email: "Correo",
        emailPlaceholder: "you@example.com",
        submit: "Enviar enlace",
        submitting: "Enviando…",
        back: "Volver a iniciar sesión",
        success: "Si la cuenta existe, se envió un enlace de restablecimiento.",
      },
      pt: {
        title: "Esqueci a senha — Cyrptonvest",
        heading: "Redefina sua senha",
        sub: "Digite seu e-mail e enviaremos um link de redefinição.",
        email: "E-mail",
        emailPlaceholder: "you@example.com",
        submit: "Enviar link",
        submitting: "Enviando…",
        back: "Voltar ao login",
        success: "Se a conta existir, um link de redefinição foi enviado.",
      },
      de: {
        title: "Passwort vergessen — Cyrptonvest",
        heading: "Passwort zurücksetzen",
        sub: "Geben Sie Ihre E-Mail-Adresse ein, wir senden einen Reset-Link.",
        email: "E-Mail",
        emailPlaceholder: "you@example.com",
        submit: "Reset-Link senden",
        submitting: "Wird gesendet…",
        back: "Zurück zum Login",
        success: "Falls das Konto existiert, wurde ein Reset-Link gesendet.",
      },
      ko: {
        title: "비밀번호 찾기 — Cyrptonvest",
        heading: "비밀번호 재설정",
        sub: "이메일을 입력하면 재설정 링크를 보내드립니다.",
        email: "이메일",
        emailPlaceholder: "you@example.com",
        submit: "재설정 링크 보내기",
        submitting: "보내는 중…",
        back: "로그인으로 돌아가기",
        success: "해당 계정이 존재하면 재설정 링크가 전송되었습니다.",
      },
      ms: {
        title: "Lupa kata laluan — Cyrptonvest",
        heading: "Tetapkan semula kata laluan",
        sub: "Masukkan e-mel akaun anda dan kami akan hantar pautan tetapan semula.",
        email: "E-mel",
        emailPlaceholder: "you@example.com",
        submit: "Hantar pautan",
        submitting: "Menghantar…",
        back: "Kembali ke log masuk",
        success: "Jika akaun itu wujud, pautan tetapan semula telah dihantar.",
      },
      ta: {
        title: "கடவுச்சொல் மறந்துவிட்டதா — Cyrptonvest",
        heading: "கடவுச்சொல்லை மாற்றவும்",
        sub: "உங்கள் மின்னஞ்சலை உள்ளிடுங்கள், மாற்றும் இணைப்பை அனுப்புவோம்.",
        email: "மின்னஞ்சல்",
        emailPlaceholder: "you@example.com",
        submit: "இணைப்பை அனுப்பு",
        submitting: "அனுப்பப்படுகிறது…",
        back: "உள்நுழைவுக்குத் திரும்பு",
        success: "அந்தக் கணக்கு இருந்தால், மாற்ற இணைப்பு அனுப்பப்பட்டுள்ளது.",
      },
    }
  };

  function normalizeLocale(input) {
    const raw = String(input || "").toLowerCase();
    if (raw.startsWith("fr")) return "fr";
    if (raw.startsWith("sw")) return "sw";
    if (raw.startsWith("zh")) return "zh";
    if (raw.startsWith("ja")) return "ja";
    if (raw.startsWith("th")) return "th";
    if (raw.startsWith("ar")) return "ar";
    if (raw.startsWith("hi")) return "hi";
    if (raw.startsWith("es")) return "es";
    if (raw.startsWith("pt")) return "pt";
    if (raw.startsWith("de")) return "de";
    if (raw.startsWith("ko")) return "ko";
    if (raw.startsWith("ms")) return "ms";
    if (raw.startsWith("ta")) return "ta";
    return "en";
  }

  function detectLocale() {
    return normalizeLocale(localStorage.getItem("cv_locale") || navigator.language || "en");
  }

  function saveLocale(locale) {
    localStorage.setItem("cv_locale", normalizeLocale(locale));
  }

  function detectCurrency() {
    const raw = String(localStorage.getItem("cv_locale") || navigator.language || "").toUpperCase();

    if (raw.includes("-KE")) return "KES";
    if (raw.includes("-UG")) return "UGX";
    if (raw.includes("-TZ")) return "TZS";
    if (raw.includes("-RW")) return "RWF";
    if (raw.includes("-NG")) return "NGN";
    if (raw.includes("-GH")) return "GHS";
    if (raw.includes("-ZA")) return "ZAR";
    if (raw.includes("-US")) return "USD";
    if (raw.includes("-GB")) return "GBP";
    if (raw.includes("-EU")) return "EUR";
    if (raw.includes("-FR")) return "EUR";
    if (raw.includes("-DE")) return "EUR";
    if (raw.includes("-ES")) return "EUR";
    if (raw.includes("-PT")) return "EUR";
    if (raw.includes("-CN")) return "CNY";
    if (raw.includes("-JP")) return "JPY";
    if (raw.includes("-TH")) return "THB";
    if (raw.includes("-KR")) return "KRW";
    if (raw.includes("-MY")) return "MYR";
    if (raw.includes("-SG")) return "SGD";
    if (raw.includes("-IN")) return "INR";
    if (raw.includes("-SA")) return "SAR";
    if (raw.includes("-AE")) return "AED";

    return "USD";
  }

  function saveCurrency(currency) {
    localStorage.setItem("cv_currency", currency || "USD");
  }

  function getCurrency() {
    return localStorage.getItem("cv_currency") || detectCurrency();
  }

  function ensurePreferences() {
    const locale = detectLocale();
    const currency = getCurrency();
    saveLocale(locale);
    saveCurrency(currency);
    return { locale, currency };
  }

  function buildLanguageSwitcher(container, currentLocale, onChange) {
    if (!container) return;
    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.justifyContent = "center";
    wrap.style.margin = "0 0 12px";

    const select = document.createElement("select");
    select.style.padding = "10px 12px";
    select.style.borderRadius = "12px";
    select.style.border = "1px solid #1d2640";
    select.style.background = "#0a1122";
    select.style.color = "#e6edf3";
    select.style.outline = "none";
    select.style.minWidth = "220px";

    SUPPORTED_LOCALES.forEach((locale) => {
      const option = document.createElement("option");
      option.value = locale;
      option.textContent = `${LOCALE_FLAGS[locale] || "🌍"} ${LOCALE_LABELS[locale] || locale}`;
      if (locale === currentLocale) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      const next = normalizeLocale(select.value);
      saveLocale(next);
      saveCurrency(detectCurrency());
      if (typeof onChange === "function") onChange(next);
    });

    wrap.appendChild(select);
    container.appendChild(wrap);
  }

  function applySignupText(locale) {
    const t = (TEXT.signup[locale] || TEXT.signup.en);
    document.documentElement.lang = locale;
    document.title = t.title;

    const h2 = document.querySelector("h2");
    if (h2) h2.textContent = t.heading;

    const emailLabel = document.querySelector('label[for="e"]');
    if (emailLabel) emailLabel.textContent = t.email;

    const passwordLabel = document.querySelector('label[for="p"]');
    if (passwordLabel) passwordLabel.textContent = t.password;

    const email = document.getElementById("e");
    if (email) email.placeholder = t.emailPlaceholder;

    const password = document.getElementById("p");
    if (password) password.placeholder = t.passwordPlaceholder;

    const submit = document.getElementById("submit");
    if (submit) submit.dataset.label = t.submit;

    const loginLink = document.querySelector('a[href="/login.html"]');
    if (loginLink) loginLink.textContent = t.loginLink;
  }

  function applyForgotText(locale) {
    const t = (TEXT.forgot[locale] || TEXT.forgot.en);
    document.documentElement.lang = locale;
    document.title = t.title;

    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = t.heading;

    const muted = document.querySelector(".muted");
    if (muted) muted.textContent = t.sub;

    const emailLabel = document.querySelector('label[for="email"]');
    if (emailLabel) emailLabel.textContent = t.email;

    const email = document.getElementById("email");
    if (email) email.placeholder = t.emailPlaceholder;

    const submit = document.getElementById("btn");
    if (submit) submit.dataset.label = t.submit;

    const back = document.querySelector('a[href="/login.html"]');
    if (back) back.textContent = t.back;
  }

  function getText(page, locale) {
    return (TEXT[page] && TEXT[page][locale]) || (TEXT[page] && TEXT[page].en) || {};
  }

  window.CV_PREFS = {
    SUPPORTED_LOCALES,
    normalizeLocale,
    detectLocale,
    saveLocale,
    detectCurrency,
    saveCurrency,
    getCurrency,
    ensurePreferences,
    buildLanguageSwitcher,
    applySignupText,
    applyForgotText,
    getText,
  };
})();
