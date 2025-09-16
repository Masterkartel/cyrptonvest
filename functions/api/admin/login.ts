// functions/api/admin/login.ts
import { json, bad, createSession, headerSetCookie, type Env } from "../../_utils";

type Req = { email?: string; password?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { email, password } = (await request.json().catch(() => ({}))) as Req;

    if (!email || !password) return bad("Missing email or password");
    if (email !== env.ADMIN_EMAIL || password !== env.ADMIN_PASSWORD) {
      return bad("Invalid admin credentials");
    }

    // issue an admin-scoped session
    const { cookieValue, expires } = await createSession(env, `admin:${email}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": headerSetCookie(env, cookieValue, expires),
      },
    });
  } catch (e: any) {
    return json({ error: `Admin login failed: ${e?.message || e}` }, { status: 500 });
  }
};
