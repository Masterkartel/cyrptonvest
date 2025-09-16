// functions/api/auth/reset.ts
import { json, bad, hashPassword } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { token, password } = await ctx.request.json<{
      token: string;
      password: string;
    }>();
    if (!token || !password) return bad("Token and password required");

    // Lookup token
    const row = await ctx.env.DB.prepare(
      "SELECT user_id, created_at FROM password_resets WHERE token = ?"
    )
      .bind(token)
      .first<{ user_id: string; created_at: number }>();

    if (!row) return bad("Invalid or expired token", 400);

    // Optional: expire after 1 hour
    if (Date.now() - row.created_at > 1000 * 60 * 60) {
      return bad("Token expired", 400);
    }

    // Update password
    const hashed = await hashPassword(password);
    await ctx.env.DB.prepare(
      "UPDATE users SET password_hash = ? WHERE id = ?"
    )
      .bind(hashed, row.user_id)
      .run();

    // Delete token
    await ctx.env.DB.prepare("DELETE FROM password_resets WHERE token = ?")
      .bind(token)
      .run();

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return bad("Something went wrong", 500);
  }
};
