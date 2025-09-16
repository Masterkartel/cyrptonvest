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

    // Build absolute reset link from request origin
    const origin = new URL(request.url).origin;
    const link = `${origin}/reset.html?token=${encodeURIComponent(token)}`;

    // Send email (if RESEND configured, it will send; else logs to Functions)
    const html = `
      <div style="font-family:Inter,system-ui,Segoe UI,Arial">
        <h2>Reset your Cyrptonvest password</h2>
        <p>We received a request to reset the password for <b>${email}</b>.</p>
        <p>This link will expire in 30 minutes:</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 14px;background:#f59e0b;color:#0b0f19;border-radius:8px;text-decoration:none;font-weight:700">Reset Password</a></p>
        <p>If you didn’t request this, you can ignore this email.</p>
        <hr/>
        <p style="color:#94a3b8">If the button doesn't work, copy and paste this URL:</p>
        <p style="word-break:break-all">${link}</p>
      </div>
    `;
    await sendEmail(env, email, "Reset your Cyrptonvest password", html);

    return json({ ok: true, message: "If that account exists, a reset link has been sent." });
  } catch (e: any) {
    return bad("Unable to process request", 500);
  }
};
