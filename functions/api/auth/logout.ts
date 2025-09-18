// functions/api/auth/logout.ts
import { json, destroySession, type Env } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  // Build a JSON response first
  const res = json({ ok: true });

  // Expire the cv_session cookie with matching attributes (domain/secure)
  // This uses the request URL to mirror cookie attrs correctly.
  destroySession(res, ctx.request);

  return res;
};
