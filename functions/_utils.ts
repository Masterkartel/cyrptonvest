// Shared helpers for Pages Functions (D1 + auth guards)

export type Env = {
  DB: D1Database
  // Set this in Cloudflare Pages > Settings > Environment variables
  ADMIN_EMAIL: string // e.g. support@cyrptonvest.com
}

// Basic JSON response helper
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  })
}

// Read the current user from a cookie the way your site already does.
// If you use a different cookie name or format, adjust here in one place.
function parseAuthCookie(req: Request) {
  const cookie = req.headers.get("Cookie") || ""
  const m = /cv_user=([A-Za-z0-9._-]+)/.exec(cookie)
  if (!m) return null
  try {
    // Very light “session” – you may already set cv_user to the email.
    // If you use JWT, decode/verify here instead.
    return { email: decodeURIComponent(m[1]) }
  } catch {
    return null
  }
}

export async function requireUser(env: Env, req: Request) {
  const u = parseAuthCookie(req)
  if (!u) return { ok: false as const, res: json({ error: "Unauthorized" }, 401) }
  // Resolve user in DB
  const row = await env.DB
    .prepare("SELECT id, email FROM users WHERE email = ? LIMIT 1")
    .bind(u.email)
    .first<{ id: string; email: string }>()
  if (!row) return { ok: false as const, res: json({ error: "Unauthorized" }, 401) }
  return { ok: true as const, user: row }
}

export async function requireAdmin(env: Env, req: Request) {
  const gate = await requireUser(env, req)
  if (!gate.ok) return gate
  const adminEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase()
  if (!adminEmail || gate.user.email.toLowerCase() !== adminEmail) {
    return { ok: false as const, res: json({ error: "Forbidden" }, 403) }
  }
  return gate
}

// Simple pagination helpers
export function getPagination(url: URL) {
  const limit = Math.min( Number(url.searchParams.get("limit") || "50"), 200 )
  const page  = Math.max( Number(url.searchParams.get("page")  || "1"), 1 )
  const offset = (page - 1) * limit
  return { limit, page, offset }
}
