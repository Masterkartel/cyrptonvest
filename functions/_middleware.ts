// functions/_middleware.ts
import { parseCookies, cookieName, getUserFromSession } from "./_utils";

export const onRequest: PagesFunction = async ({ request, env, next, data }) => {
  // Always default to no user
  data.user = null;

  // Try to restore session
  const user = await getUserFromSession(env, request);
  if (user) {
    data.user = user;
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // Protect /admin routes
  if (path.startsWith("/admin")) {
    // Require logged-in admin
    const adminEmail = (env.ADMIN_EMAIL || "support@cyrptonvest.com").toLowerCase();
    if (!data.user || data.user.email?.toLowerCase() !== adminEmail) {
      // If it’s an API endpoint (/api/admin/*), reject outright
      if (path.startsWith("/api/admin")) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      // For /admin UI pages, allow rendering — the frontend will gate
    }
  }

  // Let other requests pass through
  return next();
};
