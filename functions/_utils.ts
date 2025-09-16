export const SUPPORT_EMAIL = "support@cyrptonvest.com";

export function json(data: any, init?: number | ResponseInit) {
  if (typeof init === "number") init = { status: init };
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(";").forEach(p => {
    const [k, ...v] = p.trim().split("=");
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

export async function getSession(env: Env, request: Request) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sid = cookies["cv_sess"];
  if (!sid) return null;

  // sessions: id TEXT PK, user_id TEXT, created_at INTEGER
  // users: id TEXT PK, email TEXT UNIQUE, created_at INTEGER
  const row = await env.DB.prepare(
    `SELECT s.user_id, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? LIMIT 1`
  ).bind(sid).first<{ user_id: string; email: string }>();

  return row || null;
}

export async function requireAdmin(env: Env, request: Request) {
  const sess = await getSession(env, request);
  if (!sess) return { ok: false as const, res: json({ error: "UNAUTHORIZED" }, 401) };
  const isAdmin = (sess.email || "").toLowerCase() === SUPPORT_EMAIL;
  if (!isAdmin) return { ok: false as const, res: json({ error: "FORBIDDEN" }, 403) };
  return { ok: true as const, sess };
}

export type Env = {
  DB: D1Database;
};
