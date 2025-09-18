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
    if (!u) {
      // Don't leak which part is wrong
      return bad("Invalid email or password", 400);
    }

    const ok = await verifyPassword(String(password), String(u.password_hash || ""));
    if (!ok) return bad("Invalid email or password", 400);

    // Build response first
    const res = json({
      ok: true,
      user: { id: u.id, email: u.email },
    });

    // Set session cookie (createSession inside _utils handles FK retry)
    setCookie(
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
      ctx.request // for domain/secure attributes
    );

    return res;
  } catch (e: any) {
    const msg = String(e?.message || "");
    // Normalize DB messages so UI doesn't show scary internals
    if (/FOREIGN KEY constraint failed/i.test(msg)) {
      return bad("Service temporarily unavailable. Please try again.", 503);
    }
    return bad("SERVICE_ERROR", 503);
  }
};
