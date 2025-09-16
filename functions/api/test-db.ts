import { json, type Env } from "../_utils";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    if (!ctx.env.DB) return new Response(JSON.stringify({ ok:false, error:"DB binding missing" }), { status:503 });
    const row = await ctx.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return json({ ok: row?.ok === 1 ? "yes" : "no" });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error:String(e?.message||e) }), { status:500 });
  }
};
