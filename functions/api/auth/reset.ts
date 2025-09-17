// functions/api/auth/reset.ts
import {
  json, bad, db, hashPasswordBcrypt, isReasonablePassword, sendEmail, type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { env, request } = ctx;
    const { token, password } = await ctx.request.json().catch(() => ({}));
    if (!token || typeof token !== "string") return bad("Invalid token", 400);
    if (!password || !isReasonablePassword(password)) {
      return bad("Password must be at least 8 characters", 400);
    }

    const now = Date.now();

    const row = await db(env)
      .prepare("SELECT id, email, token, expires_at, used_at FROM reset_tokens WHERE token = ? LIMIT 1")
      .bind(token)
      .first<{ id: number; email: string; expires_at: number; used_at: number | null }>();

    if (!row) return bad("Invalid or expired token", 400);
    if (row.used_at) return bad("This reset link has already been used", 400);
    if (now > (row.expires_at || 0)) return bad("This reset link has expired", 400);

    // Update password for the user (by email)
    const hashed = await hashPasswordBcrypt(password);
    await db(env)
      .prepare("UPDATE users SET password_hash = ? WHERE lower(email) = ?")
      .bind(hashed, row.email.toLowerCase())
      .run();

    // Mark token used
    await db(env)
      .prepare("UPDATE reset_tokens SET used_at = ? WHERE id = ?")
      .bind(now, row.id)
      .run();

    // Fire-and-forget: send "password changed" confirmation
    try {
      const base =
        (env as any).WEB_BASE_URL?.replace(/\/+$/, "") ||
        new URL(request.url).origin;
      const dash = `${base}/dashboard/`;
      const first = row.email.split("@")[0] || "there";

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
            <td align="right" style="color:#9aa4b2;font-size:12px">Password changed</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:22px">
          <h2 style="margin:0 0 8px">Your password was changed</h2>
          <p style="margin:0 0 12px;color:#cbd5e1">Hi ${first}, this is a confirmation that your password has just been changed.</p>
          <a href="${dash}" style="display:inline-block;background:linear-gradient(180deg,#fbbf24,#f59e0b);color:#111827;font-weight:800;padding:12px 16px;border-radius:999px">Open Dashboard</a>
          <p style="margin:12px 0 0;color:#9aa4b2">If this wasn’t you, please <a href="mailto:support@cyrptonvest.com">contact support</a> immediately.</p>
        </td></tr>
        <tr><td style="padding:12px 22px;border-top:1px solid #1d2640;color:#9aa4b2;font-size:12px">© ${new Date().getFullYear()} Cyrptonvest. All rights reserved.</td></tr>
      </table></td></tr></table></body></html>
      `;

      sendEmail(env, row.email, "Your Cyrptonvest password was changed", html)
        .catch((e: any) => console.error("[password changed email]", e));
    } catch (e) {
      console.error("[password changed email] build/send error", e);
    }

    return json({ ok: true, message: "Password updated" });
  } catch (e: any) {
    return bad("Unable to reset password", 500);
  }
};
