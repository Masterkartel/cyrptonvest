// functions/_lib/emailTemplates.ts
const WRAP_TOP = (title = 'Cyrptonvest') => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8">
<title>${title}</title>
<style>a{color:#f59e0b;text-decoration:none}@media (prefers-color-scheme:dark){body{background:#0b0f19;color:#e6edf3}}</style>
</head><body style="margin:0;background:#0b0f19;color:#e6edf3;font:15px/1.6 Inter,system-ui,Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f19"><tr><td align="center" style="padding:24px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:
radial-gradient(900px 500px at -10% -40%, rgba(245,158,11,.22), transparent 55%),
radial-gradient(900px 600px at 120% 0%,   rgba(34,197,94,.18), transparent 55%),
linear-gradient(180deg,#101934,#0c1226);border:1px solid #27335a;border-radius:16px;overflow:hidden">
<tr><td style="padding:16px 20px;border-bottom:1px solid #1d2640">
  <table width="100%"><tr>
    <td style="font-weight:800;font-size:16px;color:#e6edf3"><img src="https://cyrptonvest.com/assets/logo.svg" width="22" height="22" alt="logo" style="vertical-align:middle;margin-right:8px">Cyrptonvest</td>
    <td align="right" style="color:#9aa4b2;font-size:12px">${title}</td>
  </tr></table>
</td></tr>
<tr><td style="padding:22px">`;

const WRAP_BOTTOM = `</td></tr>
<tr><td style="padding:12px 22px;border-top:1px solid #1d2640;color:#9aa4b2;font-size:12px">
  © ${new Date().getFullYear()} Cyrptonvest. All rights reserved.
</td></tr></table></td></tr></table></body></html>`;

function cta(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px"><tr><td>
    <a href="${href}" style="display:inline-block;background:linear-gradient(180deg,#fbbf24,#f59e0b);color:#111827;font-weight:800;padding:12px 16px;border-radius:999px">${label}</a>
  </td></tr></table>`;
}

export function welcomeHTML(firstName: string, dashboardUrl: string) {
  return WRAP_TOP('Welcome aboard') + `
    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3">AI-powered trading. Smart bots. Real results.</h1>
    <p style="margin:0 0 14px;color:#cbd5e1">Hi ${firstName}, welcome to <strong style="color:#e6edf3">Cyrptonvest</strong>! Your account is ready.</p>
    <div style="margin:12px 0 18px">
      <span style="display:inline-block;padding:6px 10px;border:1px solid #2a3a66;background:#0f1a36;border-radius:999px;font-size:12px;color:#d1d5db;margin-right:6px">🤖 AI Bots</span>
      <span style="display:inline-block;padding:6px 10px;border:1px solid #2a3a66;background:#0f1a36;border-radius:999px;font-size:12px;color:#d1d5db;margin-right:6px">📊 Auto-Execution</span>
      <span style="display:inline-block;padding:6px 10px;border:1px solid #2a3a66;background:#0f1a36;border-radius:999px;font-size:12px;color:#d1d5db">⚙️ 24/7</span>
    </div>
    ${cta(dashboardUrl, 'Go to Dashboard')}
    <div style="border:1px solid #1d2640;background:#0f1629;border-radius:12px;padding:12px">
      <p style="margin:0 6px 8px 0;color:#9aa4b2"><strong style="color:#e6edf3">Next steps</strong></p>
      <ul style="margin:0;padding-left:18px;color:#cbd5e1">
        <li>Pick a plan (Starter, Growth, Professional)</li>
        <li>Deposit BTC, USDT-TRC20, or ETH</li>
        <li>Track performance and withdraw securely</li>
      </ul>
    </div>
  ` + WRAP_BOTTOM;
}

export function welcomeText(firstName: string, dashboardUrl: string) {
  return `Welcome to Cyrptonvest

Hi ${firstName}, your account is ready.
Pick a plan, deposit crypto, and track your growth in real time.

Go to Dashboard: ${dashboardUrl}`;
}

export function resetHTML(firstName: string, resetUrl: string) {
  return WRAP_TOP('Password reset') + `
    <h2 style="margin:0 0 8px">Reset your password</h2>
    <p style="margin:0 0 12px;color:#cbd5e1">Hi ${firstName}, tap the button below to set a new password.</p>
    ${cta(resetUrl, 'Reset password')}
    <p style="margin:6px 0 0;color:#9aa4b2">If you didn’t request this, you can ignore this email.</p>
    <p style="margin:6px 0 0;color:#9aa4b2">Link: <a href="${resetUrl}">${resetUrl}</a></p>
  ` + WRAP_BOTTOM;
}

export function resetText(firstName: string, resetUrl: string) {
  return `Reset your password

Hi ${firstName}, use the link below to set a new password:
${resetUrl}

If you didn’t request this, ignore this email.`;
}

export function changedHTML(firstName: string, dashboardUrl: string) {
  return WRAP_TOP('Password changed') + `
    <h2 style="margin:0 0 8px">Your password was changed</h2>
    <p style="margin:0 0 12px;color:#cbd5e1">Hi ${firstName}, this is a confirmation that your password has just been changed.</p>
    ${cta(dashboardUrl, 'Open Dashboard')}
    <p style="margin:6px 0 0;color:#9aa4b2">If this wasn’t you, please <a href="mailto:support@cyrptonvest.com">contact support</a> immediately.</p>
  ` + WRAP_BOTTOM;
}

export function changedText(firstName: string, dashboardUrl: string) {
  return `Your password was changed

Hi ${firstName}, this is a confirmation that your password has been changed.
If this wasn’t you, contact support immediately.

Dashboard: ${dashboardUrl}`;
}
