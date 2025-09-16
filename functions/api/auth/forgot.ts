// functions/api/auth/forgot.ts
import {
  json, bad,
  sendEmail, randomTokenHex,
  sha256HexStr, db, getUserByEmail,
  type Env
} from "../../_utils";

/**
 * POST /api/auth/forgot
 * Body: { email: string }
 *
 * Always returns 200 {ok:true} (to avoid email enumeration),
 * but only sends a real email if the user exists.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { request, env } = ctx;
    const { email } = await request.json().catch(() => ({}));

    if (!email || typeof email !== "string") {
      // Still return ok to avoid enumeration
      return json({ ok: true });
    }

    const norm = email.trim().toLowerCase();
    const user = await getUserByEmail(env, norm);

    // Always respond ok to the client, even if user not found
    // (prevents attackers from discovering valid emails)
    const okResponse = json({ ok: true });

    if (!user) return okResponse;

    // Ensure reset_tokens table exists
    await ensureResetTable(env);

    // Create a one-time token (store only the hash in DB)
    const tokenPlain = randomTokenHex(32);
    const tokenHash = await sha256HexStr(tokenPlain);

    const now = Math.floor(Date.now() / 1000);
    const expires = now + 60 * 30; // 30 minutes

    const id = randomTokenHex(16);

    await db(env)
      .prepare(
        `INSERT INTO reset_tokens (id, email, token_hash, created_at, expires_at, used)
         VALUES (?, ?, ?, ?, ?, 0)`
      )
      .bind(id, norm, tokenHash, now, expires)
      .run();

    // Build reset link pointing to your frontend page (adjust filename/path if different)
    // Example reset page: /reset.html which will POST to /api/auth/reset
    const origin = new URL(request.url).origin;
    const link = `${origin}/reset.html?email=${encodeURIComponent(norm)}&token=${tokenPlain}`;

    // Send email
    const subject = "Reset your Cyrptonvest password";
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto">
        <h2 style="margin:0 0 10px;color:#111">Cyrptonvest</h2>
        <p>We received a request to reset the password for <strong>${norm}</strong>.</p>
        <p>This link will expire in <strong>30 minutes</strong>. If you didn’t request this, you can ignore this email.</p>
        <p style="margin:22px 0">
          <a href="${link}"
             style="background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;display:inline-block">
            Reset Password
          </a>
        </p>
        <p style="font-size:12px;color:#555">Or copy and paste this URL into your browser:<br>
          <span style="word-break:break-all;color:#0369a1">${link}</span>
        </p>
      </div>
    `;

    await sendEmail(env, norm, subject, html);

    return okResponse;
  } catch (e) {
    console.error("forgot error", e);
    // Still return ok to the client
    return json({ ok: true });
  }
};

// Create table if it doesn't exist
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
