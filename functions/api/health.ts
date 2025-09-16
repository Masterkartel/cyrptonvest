// functions/api/health.ts
export const onRequestGet: PagesFunction = async ({ env }) => {
  try {
    // Check env vars
    const okVars = {
      AUTH_COOKIE_SECRET: env.AUTH_COOKIE_SECRET ? "ok" : "missing",
      ADMIN_EMAIL: env.ADMIN_EMAIL ? "ok" : "missing",
      ADMIN_PASSWORD: env.ADMIN_PASSWORD ? "ok" : "missing",
      DB: env.DB ? "bound" : "missing",
    };

    // Optional DB ping (guarded)
    let dbPing = "skipped";
    if (env.DB) {
      try {
        await env.DB.prepare("SELECT 1 as one").first();
        dbPing = "ok";
      } catch (e) {
        dbPing = "fail";
      }
    }

    return new Response(
      JSON.stringify({ ...okVars, DB_PING: dbPing }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
