// functions/api/auth/reset.ts
import {
  json, bad,
  sha256HexStr, db, isReasonablePassword, hashPasswordBcrypt,
  type Env
} from "../../_utils";

/**
 * POST /api/auth/reset
 * Body: { email: string, token: string, new_password: string }
 *
 * Verifies token (hash match, not used, not expired), updates password,
 * and marks the token as used.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { request, env } = ctx;
    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").toString().trim().toLowerCase();
    const token = (body.token || "").toString().trim();
    const newPw = (body.new_password || "").toString();

    if (!email || !token || !newPw) {
      return bad("Missing fields", 400);
    }
    if (!isReasonablePassword(newPw)) {
      return bad("Password must be at least 8 characters.", 400);
    }

    // Ensure table exists (safe if already created)
    await ensureResetTable(env);

    const tokenHash = await sha256HexStr(token);
    const now = Math.floor(Date.now() / 1000);

    // Find valid token
    const rec = await db(env)
      .prepare(
        `SELECT id, email, token_hash, created_at, expires_at, used
         FROM reset_tokens
         WHERE email = ? AND token_hash = ? AND used = 0 AND expires_at > ?
         LIMIT 1`
      )
      .bind(email, tokenHash, now)
      .first<{ id: string }>();

    if (!rec) {
      // Invalid or expired token
      return bad("Invalid or expired link.", 400);
    }

    // Hash new password (bcrypt if available; fallback to salted sha256)
    const newHash = await hashPasswordBcrypt(newPw);

    // Update user password
    await db(env)
      .prepare(`UPDATE users SET password_hash = ? WHERE lower(email) = ?`)
      .bind(newHash, email)
      .run();

    // Mark token as used
    await db(env)
      .prepare(`UPDATE reset_tokens SET used = 1 WHERE id = ?`)
      .bind(rec.id)
      .run();

    return json({ ok: true });
  } catch (e) {
    console.error("reset error", e);
    return bad("Unable to reset password", 500);
  }
};

// Reuse the same ensure helper
async function ensureResetTable(env: Env) {
  await db(env).exec(`
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_reset_email ON reset_tokens(email);
    CREATE INDEX IF NOT EXISTS idx_reset_expires ON reset_tokens(expires_at);
  `);
}
