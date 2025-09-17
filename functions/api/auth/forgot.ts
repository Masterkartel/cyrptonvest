// functions/api/auth/forgot.ts
import {
  json, bad, db, getUserByEmail, sendEmail, randomTokenHex, type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { request, env } = ctx;
    const { email } = await request.json().catch(() => ({}));
    if (!email || typeof email !== "string") return bad("Email required", 400);

    const user = await getUserByEmail(env, email);
    // Always act the same regardless of existence (no user enumeration)
    const token = randomTokenHex(32);
    const now = Date.now();
    const expires = now + 1000 * 60 * 30; // 30 minutes

    await db(env)
      .prepare(
        "INSERT INTO reset_tokens (email, token, expires_at, created_at) VALUES (?, ?, ?, ?)"
      )
      .bind(email.toLowerCase(), token, expires, now)
      .run()
      .catch(() => { /* swallow insert errors */ });

    // Prefer configured base URL; otherwise fall back to request origin
    const base =
      (env as any).WEB_BASE_URL?.replace(/\/+$/, "") ||
      new URL(request.url).origin;

    const link = `${base}/reset.html?token=${encodeURIComponent(token)}`;
    const first = (user?.name || email.split("@")[0] || "there");

    // On-brand HTML
    const html = `
    <!doctype html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8">
      <style>a{color:#f59e0b;text-decoration:none}</style>
    </head><body style="margin:0;background:#0b0f19;color:#e6edf3;font:15px/1.6 Inter,system-ui,Segoe UI,Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f19"><tr><td align="center" style="padding:24px">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:
    radial-gradient(900px 500px at -10% -40%, rgba(245,158,11,.22), transparent 55%),
    radial-gradient(900px 600px at 120% 0%,   rgba(34,197,94,.18), transparent 55%),
    linear-gradient(180deg,#101934,#0c1226);border:1px solid #27335a;border-radius:16px;overflow:hidden">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #1d2640">
        <table width="100%"><tr>
          <td style="font-weight:800;font-size:16px;color:#e6edf3"><img src="https://cyrptonvest.com/assets/logo.svg" width="22" height="22" alt="logo" style="vertical-align:middle;margin-right:8px">Cyrptonvest</td>
          <td align="right" style="color:#9aa4b2;font-size:12px">Password reset</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px">
        <h2 style="margin:0 0 8px">Reset your password</h2>
        <p style="margin:0 0 12px;color:#cbd5e1">Hi ${first}, tap the button below to set a new password. This link expires in 30 minutes.</p>
        <a href="${link}" style="display:inline-block;background:linear-gradient(180deg,#fbbf24,#f59e0b);color:#111827;font-weight:800;padding:12px 16px;border-radius:999px">Reset password</a>
        <div style="border:1px solid #1d2640;background:#0f1629;border-radius:12px;padding:12px;margin-top:12px;color:#cbd5e1">
          If the button doesn’t work, copy and paste this URL:<br>
          <span style="word-break:break-all"><a href="${link}">${link}</a></span>
        </div>
        <p style="margin:12px 0 0;color:#9aa4b2">If you didn’t request this, you can ignore this email.</p>
      </td></tr>
      <tr><td style="padding:12px 22px;border-top:1px solid #1d2640;color:#9aa4b2;font-size:12px">© ${new Date().getFullYear()} Cyrptonvest. All rights reserved.</td></tr>
    </table></td></tr></table></body></html>
    `;

    await sendEmail(env, email, "Reset your Cyrptonvest password", html);

    return json({ ok: true, message: "If that account exists, a reset link has been sent." });
  } catch (e: any) {
    return bad("Unable to process request", 500);
  }
};
