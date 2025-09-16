// functions/_middleware.ts

import {
  parseCookies,
  cookieName,
  getUserFromSession,
  type Env,
} from "./_utils";

const PUBLIC = new Set<string>([
  "/api/health",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/admin/login",
]);

// Basic CORS for API (adjust the origin if you want to lock it down)
function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
}

export const onRequest: PagesFunction<Env>[] = [
  async (ctx) => {
    const url = new URL(ctx.request.url);

    // Only touch API routes; never interfere with static pages
    if (!url.pathname.startsWith("/api/")) {
      return ctx.next();
    }

    // Preflight
    if (ctx.request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(ctx.request) });
    }

    // Public endpoints: pass straight through
    if (PUBLIC.has(url.pathname)) {
      const res = await ctx.next();
      // add headers on the way out
      res.headers.set("X-Frame-Options", "DENY");
      res.headers.set("X-Content-Type-Options", "nosniff");
      res.headers.set("Referrer-Policy", "no-referrer");
      for (const [k, v] of Object.entries(corsHeaders(ctx.request))) res.headers.set(k, v);
      return res;
    }

    // Protected / stateful enrichment (fail-open)
    try {
      // Parse cookies and hydrate session user if available
      const cookies = parseCookies(ctx.request.headers.get("Cookie") || "");
      const sid = cookies[cookieName];
      if (sid) {
        const user = await getUserFromSession(sid, ctx.env);
        if (user) {
          // Expose to route handlers if they want it
          (ctx.data as any).user = user;
        }
      }
    } catch {
      // swallow any error – we don’t block the request
    }

    // Run the actual handler
    const res = await ctx.next();

    // Security & CORS headers for all /api/* responses
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "no-referrer");
    for (const [k, v] of Object.entries(corsHeaders(ctx.request))) res.headers.set(k, v);

    return res;
  },
];
