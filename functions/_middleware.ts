// functions/_middleware.ts
// Load session (if any) and attach current user to data.user
import { parseCookies } from "./_utils";

export const onRequest: PagesFunction = async ({ request, env, next, data }) => {
  data.user = null;

  // Parse cookies and check session
  const cookies = parseCookies(request);
  const sid = cookies["session"];
  if (sid) {
    const row = await env.DB.prepare(
      `SELECT s.user_id, s.expires_at, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    ).bind(sid).first();

    if (row && Date.now() < row.expires_at) {
      data.user = { id: row.user_id, email: row.email };
    }
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Protect /admin pages
  if (path.startsWith("/admin")) {
    const user = data.user;

    // Allow support@cyrptonvest.com, block others
    if (!user || user.email?.toLowerCase() !== "support@cyrptonvest.com") {
      // If it's an API call (/api/admin/*), reject outright
      if (path.startsWith("/api/admin")) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      // For /admin UI, let the page render — the gate inside index.html will handle login
    }
  }

  return next();
};
