export const SUPPORTED_LOCALES = [
  "en", // English
  "fr", // French
  "sw", // Swahili
  "zh", // Chinese
  "ja", // Japanese
  "th", // Thai
  "ar", // Arabic
  "hi", // Hindi
  "es", // Spanish
  "pt", // Portuguese
  "de", // German
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export function normalizeLocale(input?: string | null): SupportedLocale {
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

  return "en";
}

export const EMAIL_I18N = {
  en: {
    welcomeSubject: "Welcome to Cyrptonvest 🎉",
    welcomeHeading: "AI-powered trading. Smart bots. Real results.",
    welcomeBody: (n: string) => `Hi ${n}, your account is ready.`,
    welcomeButton: "Go to Dashboard",
    resetSubject: "Reset your Cyrptonvest password",
    changedSubject: "Your password was changed",
  },

  fr: {
    welcomeSubject: "Bienvenue sur Cyrptonvest 🎉",
    welcomeHeading: "Trading avec IA. Résultats réels.",
    welcomeBody: (n: string) => `Bonjour ${n}, votre compte est prêt.`,
    welcomeButton: "Ouvrir le tableau de bord",
    resetSubject: "Réinitialisez votre mot de passe",
    changedSubject: "Votre mot de passe a été modifié",
  },

  sw: {
    welcomeSubject: "Karibu Cyrptonvest 🎉",
    welcomeHeading: "Biashara kwa AI. Matokeo halisi.",
    welcomeBody: (n: string) => `Habari ${n}, akaunti yako iko tayari.`,
    welcomeButton: "Fungua Dashboard",
    resetSubject: "Weka upya nenosiri",
    changedSubject: "Nenosiri limebadilishwa",
  },

  zh: {
    welcomeSubject: "欢迎来到 Cyrptonvest 🎉",
    welcomeHeading: "AI驱动交易，智能机器人。",
    welcomeBody: (n: string) => `你好 ${n}，你的账户已准备好。`,
    welcomeButton: "进入仪表盘",
    resetSubject: "重置您的密码",
    changedSubject: "您的密码已更改",
  },

  ja: {
    welcomeSubject: "Cyrptonvestへようこそ 🎉",
    welcomeHeading: "AI取引。スマートボット。",
    welcomeBody: (n: string) => `${n}さん、アカウントが準備できました。`,
    welcomeButton: "ダッシュボードへ",
    resetSubject: "パスワードをリセット",
    changedSubject: "パスワードが変更されました",
  },

  th: {
    welcomeSubject: "ยินดีต้อนรับสู่ Cyrptonvest 🎉",
    welcomeHeading: "การเทรดด้วย AI",
    welcomeBody: (n: string) => `สวัสดี ${n} บัญชีของคุณพร้อมแล้ว`,
    welcomeButton: "ไปที่แดชบอร์ด",
    resetSubject: "รีเซ็ตรหัสผ่าน",
    changedSubject: "รหัสผ่านถูกเปลี่ยนแล้ว",
  },

  ar: {
    welcomeSubject: "مرحبًا بك في Cyrptonvest 🎉",
    welcomeHeading: "تداول بالذكاء الاصطناعي",
    welcomeBody: (n: string) => `مرحبًا ${n}، حسابك جاهز.`,
    welcomeButton: "لوحة التحكم",
    resetSubject: "إعادة تعيين كلمة المرور",
    changedSubject: "تم تغيير كلمة المرور",
  },

  hi: {
    welcomeSubject: "Cyrptonvest में आपका स्वागत है 🎉",
    welcomeHeading: "AI आधारित ट्रेडिंग",
    welcomeBody: (n: string) => `नमस्ते ${n}, आपका अकाउंट तैयार है।`,
    welcomeButton: "डैशबोर्ड खोलें",
    resetSubject: "पासवर्ड रीसेट करें",
    changedSubject: "पासवर्ड बदल दिया गया है",
  },

  es: {
    welcomeSubject: "Bienvenido a Cyrptonvest 🎉",
    welcomeHeading: "Trading con IA",
    welcomeBody: (n: string) => `Hola ${n}, tu cuenta está lista.`,
    welcomeButton: "Ir al panel",
    resetSubject: "Restablecer contraseña",
    changedSubject: "Contraseña cambiada",
  },

  pt: {
    welcomeSubject: "Bem-vindo ao Cyrptonvest 🎉",
    welcomeHeading: "Trading com IA",
    welcomeBody: (n: string) => `Olá ${n}, sua conta está pronta.`,
    welcomeButton: "Ir ao painel",
    resetSubject: "Redefinir senha",
    changedSubject: "Senha alterada",
  },

  de: {
    welcomeSubject: "Willkommen bei Cyrptonvest 🎉",
    welcomeHeading: "KI-gestützter Handel",
    welcomeBody: (n: string) => `Hallo ${n}, dein Konto ist bereit.`,
    welcomeButton: "Zum Dashboard",
    resetSubject: "Passwort zurücksetzen",
    changedSubject: "Passwort geändert",
  },
};
