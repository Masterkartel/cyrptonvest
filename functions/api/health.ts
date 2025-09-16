export const onRequestGet: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const has = (k: string) => (env?.[k] ? "ok" : "missing");
  return new Response(
    JSON.stringify({
      AUTH_COOKIE_SECRET: has("AUTH_COOKIE_SECRET"),
      ADMIN_EMAIL: has("ADMIN_EMAIL"),
      ADMIN_PASSWORD: has("ADMIN_PASSWORD"),
    }),
    { headers: { "content-type": "application/json" } }
  );
};
