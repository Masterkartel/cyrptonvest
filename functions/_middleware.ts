// functions/_middleware.ts
import { parseCookies, cookieName, getUserFromSession, type Env } from "./_utils";

const PUBLIC = new Set<string>([
  "/api/health",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",   // ← add this
  "/api/admin/login",
]);

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

    if (!url.pathname.startsWith("/api/")) {
      return ctx.next();
    }

    if (ctx.request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(ctx.request) });
    }

    if (PUBLIC.has(url.pathname)) {
      const res = await ctx.next();
      res.headers.set("X-Frame-Options", "DENY");
      res.headers.set("X-Content-Type-Options", "nosniff");
      res.headers.set("Referrer-Policy", "no-referrer");
      for (const [k, v] of Object.entries(corsHeaders(ctx.request))) res.headers.set(k, v);
      return res;
    }

    // fail-open enrichment
    try {
      const cookies = parseCookies(ctx.request.headers.get("Cookie") || "");
      const sid = cookies[cookieName];
      if (sid) {
        const user = await getUserFromSession(sid, ctx.env);
        if (user) (ctx.data as any).user = user;
      }
    } catch {}

    const res = await ctx.next();
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "no-referrer");
    for (const [k, v] of Object.entries(corsHeaders(ctx.request))) res.headers.set(k, v);
    return res;
  },
];
