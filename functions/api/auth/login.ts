// functions/api/auth/login.ts
import {
  json,
  bad,
  getUserByEmail,
  verifyPassword,
  setCookie,
  type Env,
} from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { email, password } = await ctx.request
      .json()
      .catch(() => ({} as any));

    if (!email || !password) {
      return bad("Missing email or password", 400);
    }

    const u = await getUserByEmail(ctx.env, String(email));
    if (!u) return bad("Invalid email or password", 400);

    const ok = await verifyPassword(String(password), String(u.password_hash || ""));
    if (!ok) return bad("Invalid email or password", 400);

    const res = json({
      ok: true,
      user: { id: u.id, email: u.email },
    });

    // ⬇️ IMPORTANT: await so Set-Cookie lands on this response
    await setCookie(
      res,
      ctx.env,
      {
        sub: u.id,
        email: u.email,
        role:
          ctx.env.ADMIN_EMAIL &&
          u.email.toLowerCase() === ctx.env.ADMIN_EMAIL.toLowerCase()
            ? "admin"
            : "user",
      },
      ctx.request
    );

    return res;
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (/FOREIGN KEY constraint failed/i.test(msg)) {
      return bad("Service temporarily unavailable. Please try again.", 503);
    }
    return bad("SERVICE_ERROR", 503);
  }
};
