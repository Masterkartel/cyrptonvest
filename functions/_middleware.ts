// Load session (if any) and attach current user to data.user
import { parseCookies } from "../_utils";

export const onRequest: PagesFunction = async ({ request, env, next, data }) => {
  data.user = null;

  const cookies = parseCookies(request);
  const sid = cookies["session"];
  if (sid) {
    const row = await env.DB.prepare(
      "SELECT s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?"
    ).bind(sid).first();

    if (row && Date.now() < row.expires_at) {
      data.user = { id: row.user_id, email: row.email };
    }
  }

  return next();
};
