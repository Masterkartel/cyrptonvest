// functions/api/me.ts
import { json, requireAuth, type Env } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const sess = await requireAuth(ctx.request, ctx.env);
    // Return only what the dashboard needs
    return json({
      ok: true,
      user: {
        id: sess.sub,
        email: sess.email,
        role: sess.role,
      },
    });
  } catch (e:any) {
    // If not logged in, be explicit
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
};
