// functions/api/auth/reset.ts
import {
  json, bad, db, hashPasswordBcrypt, isReasonablePassword, type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { env } = ctx;
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

    return json({ ok: true, message: "Password updated" });
  } catch (e: any) {
    return bad("Unable to reset password", 500);
  }
};
