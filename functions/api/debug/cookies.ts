// functions/api/debug/cookies.ts
export const onRequestGet: PagesFunction = async (ctx) => {
  const u = new URL(ctx.request.url);
  const cookie = ctx.request.headers.get("cookie") || "";
  const res = {
    host: u.hostname,
    scheme: u.protocol.replace(":", ""),
    receivedCookieHeader: cookie,
  };
  return new Response(JSON.stringify(res, null, 2), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
