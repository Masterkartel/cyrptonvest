// functions/_lib/email.ts
export interface Env {
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  REPLY_TO?: string;
  WEB_BASE_URL?: string;
}

type EmailArgs = { to: string; subject: string; html: string; text: string };

export async function sendEmail(env: Env, { to, subject, html, text }: EmailArgs) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to,
      subject,
      html,
      text,
      reply_to: env.REPLY_TO || undefined,
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Resend error ${res.status}: ${msg}`);
  }
  return res.json().catch(() => ({}));
}

// Helpers
export function firstNameFrom(name?: string | null, email?: string) {
  if (name && name.trim()) return name.trim().split(/\s+/)[0];
  if (email) return email.split('@')[0];
  return 'there';
}

export function baseUrl(env: Env, requestUrl?: string) {
  if (env.WEB_BASE_URL) return env.WEB_BASE_URL.replace(/\/+$/, '');
  try { return new URL(requestUrl || 'https://cyrptonvest.com').origin; } catch { return 'https://cyrptonvest.com'; }
}
