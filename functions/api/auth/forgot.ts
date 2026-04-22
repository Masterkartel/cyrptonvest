// functions/api/auth/forgot.ts
import {
  json,
  bad,
  db,
  getUserByEmail,
  sendEmail,
  randomTokenHex,
  type Env,
} from "../../_utils";
import { normalizeLocale, EMAIL_I18N } from "../../_i18n";

type ReqBody = {
  email?: string;
  locale?: string;
  currency?: string;
};

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFriendlyNameFromEmail(email: string): string {
  const local = String(email || "").split("@")[0] || "there";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  return cleaned || "there";
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { request, env } = ctx;
    const body = await request.json().catch(() => ({} as ReqBody));

    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return bad("Email required", 400);

    const user = await getUserByEmail(env, email);

    const locale = normalizeLocale(user?.locale || body.locale);
    const fallback = EMAIL_I18N.en;
    const entry = EMAIL_I18N[locale] || fallback;

    const t = {
      resetSubject: entry.resetSubject || fallback.resetSubject,
    };

    const token = randomTokenHex(32);
    const now = Date.now();
    const expires = now + 1000 * 60 * 30;

    await db(env)
      .prepare("INSERT INTO reset_tokens (email, token, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .bind(email, token, expires, now)
      .run()
      .catch((e) => {
        console.warn("reset token save failed", {
          email,
          error: e instanceof Error ? e.message : String(e),
        });
      });

    const base =
      (env as any).WEB_BASE_URL?.replace(/\/+$/, "") ||
      new URL(request.url).origin;
    const link = `${base}/reset.html?token=${encodeURIComponent(token)}`;
    const first = getFriendlyNameFromEmail(email);
    const safeFirst = escapeHtml(first);

    const heading = t.resetSubject || "Reset your Cyrptonvest password";
    const buttonText = "Reset password";
    const bodyText = `Hi ${safeFirst}, tap the button below to set a new password. This link expires in 30 minutes.`;
    const fallbackText = "If the button doesn’t work, copy and paste this URL:";
    const ignoreText = "If you didn’t request this, you can ignore this email.";

    const html = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta charset="utf-8" />
    <style>a{color:#f59e0b;text-decoration:none}</style>
  </head>
  <body style="margin:0;background:#0b0f19;color:#e6edf3;font:15px/1.6 Inter,system-ui,Segoe UI,Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f19">
      <tr>
        <td align="center" style="padding:24px">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:
            radial-gradient(900px 500px at -10% -40%, rgba(245,158,11,.22), transparent 55%),
            radial-gradient(900px 600px at 120% 0%, rgba(34,197,94,.18), transparent 55%),
            linear-gradient(180deg,#101934,#0c1226);border:1px solid #27335a;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #1d2640">
                <table width="100%">
                  <tr>
                    <td style="font-weight:800;font-size:16px;color:#e6edf3">
                      <img src="${base}/assets/logo-email.png" width="22" height="22" alt="Cyrptonvest" style="vertical-align:middle;margin-right:8px;display:inline-block">Cyrptonvest
                    </td>
                    <td align="right" style="color:#9aa4b2;font-size:12px">${escapeHtml(heading)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px">
                <h2 style="margin:0 0 8px">${escapeHtml(heading)}</h2>
                <p style="margin:0 0 12px;color:#cbd5e1">${bodyText}</p>

                <a href="${link}" style="display:inline-block;background:linear-gradient(180deg,#fbbf24,#f59e0b);color:#111827;font-weight:800;padding:12px 16px;border-radius:999px">
                  ${escapeHtml(buttonText)}
                </a>

                <div style="border:1px solid #1d2640;background:#0f1629;border-radius:12px;padding:12px;margin-top:12px;color:#cbd5e1">
                  ${escapeHtml(fallbackText)}<br>
                  <span style="word-break:break-all"><a href="${link}">${escapeHtml(link)}</a></span>
                </div>

                <p style="margin:12px 0 0;color:#9aa4b2">${escapeHtml(ignoreText)}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 22px;border-top:1px solid #1d2640;color:#9aa4b2;font-size:12px">
                © ${new Date().getFullYear()} Cyrptonvest. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    try {
      await sendEmail(env, email, heading, html);
    } catch (e) {
      console.error("forgot password email failed", {
        email,
        locale,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return json({
      ok: true,
      message: "If that account exists, a reset link has been sent.",
    });
  } catch (e) {
    console.error("forgot password error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return bad("Unable to process request", 500);
  }
};
