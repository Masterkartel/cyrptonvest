// functions/_middleware.ts
import { parseCookies, cookieName, getUserFromSession, type Env } from "./_utils";

/** Only return CORS headers when the request is cross-origin. */
function corsHeadersFor(request: Request): Record<string, string> {
  const reqOrigin = request.headers.get("Origin"); // null on same-origin
  if (!reqOrigin) return {}; // same-origin → NO CORS HEADERS
  return {
    // IMPORTANT: echo the specific Origin (never '*') so cookies are allowed.
    "Access-Control-Allow-Origin": reqOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
}

const PUBLIC = new Set<string>([
  "/api/health",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/forgot",
  "/api/auth/reset",
  "/api/admin/login",
]);

export const onRequest: PagesFunction<Env>[] = [
  async (ctx) => {
    const url = new URL(ctx.request.url);

    // Only touch API routes; never interfere with static pages
    if (!url.pathname.startsWith("/api/")) {
      return ctx.next();
    }

    // CORS preflight: only when the browser sent an Origin
    if (ctx.request.method === "OPTIONS") {
      const headers = corsHeadersFor(ctx.request);
      if (Object.keys(headers).length === 0) {
        // same-origin preflight isn't meaningful: return 204 with no CORS
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 204, headers });
    }

    // Public endpoints: pass straight through
    if (PUBLIC.has(url.pathname)) {
      const res = await ctx.next();
      // Security headers (safe to always add)
      res.headers.set("X-Frame-Options", "DENY");
      res.headers.set("X-Content-Type-Options", "nosniff");
      res.headers.set("Referrer-Policy", "no-referrer");

      // Add CORS only if cross-origin. DO NOT set '*' – it kills Set-Cookie.
      const ch = corsHeadersFor(ctx.request);
      for (const [k, v] of Object.entries(ch)) res.headers.set(k, v);
      return res;
    }

    // Fail-open enrichment – never block the request on error
    try {
      const cookies = parseCookies(ctx.request);
      const sid = cookies[cookieName];
      if (sid) {
        const user = await getUserFromSession(ctx.request, ctx.env);
        if (user) (ctx.data as any).user = user;
      }
    } catch { /* swallow */ }

    const res = await ctx.next();

    // Security headers
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "no-referrer");

    // CORS headers only for cross-origin
    const ch = corsHeadersFor(ctx.request);
    for (const [k, v] of Object.entries(ch)) res.headers.set(k, v);

    return res;
  },
];
