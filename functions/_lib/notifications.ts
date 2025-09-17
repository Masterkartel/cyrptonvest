// functions/_lib/notifications.ts
import { sendEmail, firstNameFrom, baseUrl, Env } from './email';
import { welcomeHTML, welcomeText, resetHTML, resetText, changedHTML, changedText } from './emailTemplates';

export async function sendWelcome(env: Env, email: string, name?: string | null) {
  const first = firstNameFrom(name, email);
  const dash = baseUrl(env) + '/dashboard/#plans';
  return sendEmail(env, {
    to: email,
    subject: 'Welcome to Cyrptonvest 🎉',
    html: welcomeHTML(first, dash),
    text: welcomeText(first, dash),
  });
}

export async function sendReset(env: Env, email: string, token: string, name?: string | null, requestUrl?: string) {
  const first = firstNameFrom(name, email);
  const reset = baseUrl(env, requestUrl) + '/reset.html?token=' + encodeURIComponent(token);
  return sendEmail(env, {
    to: email,
    subject: 'Reset your Cyrptonvest password',
    html: resetHTML(first, reset),
    text: resetText(first, reset),
  });
}

export async function sendPasswordChanged(env: Env, email: string, name?: string | null) {
  const first = firstNameFrom(name, email);
  const dash = baseUrl(env) + '/dashboard/';
  return sendEmail(env, {
    to: email,
    subject: 'Your Cyrptonvest password was changed',
    html: changedHTML(first, dash),
    text: changedText(first, dash),
  });
}
