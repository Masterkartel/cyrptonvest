// functions/api/auth/login.ts
import {
  json,
  bad,
  headerSetCookie,
  createSession,
  getUserByEmail,
  verifyPassword,
  type Env,
} from "../../_utils";

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  // Preflight (in case someone POSTs with CORS)
  if (ctx.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(ctx.request) });
  }

  let email = "";
  let password = "";

  try {
    const body = await ctx.request.json<any>();
    email = (body?.email || "").toLowerCase().trim();
    password = String(body?.password || "");
    if (!email || !password) {
      return bad("Email and password are required", { headers: corsHeaders(ctx.request) });
    }
  } catch {
    return bad("Invalid JSON body", { headers: corsHeaders(ctx.request) });
  }

  try {
    // 1) find user
    const user = await getUserByEmail(email, ctx.env);
    if (!user) {
      return bad("Invalid credentials", { headers: corsHeaders(ctx.request) });
    }

    // 2) verify password (your _utils.verifyPassword must support your stored hashes)
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return bad("Invalid credentials", { headers: corsHeaders(ctx.request) });
    }

    // 3) create session + cookie
    const { cookie, session } = await createSession(user.id, ctx.env);
    const res = json(
      {
        ok: true,
        user: { id: user.id, email: user.email },
        session_id: session.id,
      },
      { headers: corsHeaders(ctx.request) },
    );
    headerSetCookie(res.headers, cookie);
    return res;
  } catch (err: any) {
    // Never throw – always send JSON so UI doesn’t show "Service unavailable"
    return json(
      { ok: false, error: "Login failed" },
      { status: 200, headers: corsHeaders(ctx.request) },
    );
  }
};
