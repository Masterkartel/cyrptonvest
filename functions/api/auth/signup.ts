// functions/api/auth/signup.ts
import {
  json,
  bad,
  setCookie,
  hashPasswordBcrypt,
  getUserByEmail,
  randomTokenHex,
  sendEmail,
  type Env,
} from "../../_utils";

type ReqBody = { email?: string; password?: string };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // --- Parse & validate body ---
    let body: ReqBody = {};
    try {
      body = (await request.json()) as ReqBody;
    } catch {
      return bad("Invalid JSON body", 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bad("Enter a valid email address", 400);
    }
    if (password.length < 8) {
      return bad("Password must be at least 8 characters", 400);
    }

    // --- Uniqueness check ---
    const exists = await getUserByEmail(env, email);
    if (exists) return bad("Email is already registered", 409);

    // --- Create user ---
    const id = randomTokenHex(16); // string id; sessions code supports string/number
    const password_hash = await hashPasswordBcrypt(password);
    const created_at = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, created_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(id, email, password_hash, created_at)
      .run();

    // --- Create session + Set-Cookie ---
    const role: "user" | "admin" =
      env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

    const res = json({ ok: true, user: { id, email, role } }, 200);
    // setCookie overload: (res, env, session, reqOrUrl?)
    await setCookie(res, env, { sub: id, email, role }, request);

    // --- Send welcome email (best-effort) ---
    try {
      const origin = new URL(request.url).origin.replace(/\/+$/, "");
      const dash = `${origin}/dashboard/#plans`;
      const first = email.split("@")[0] || "there";
      const html = `
<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>a{color:#f59e0b;text-decoration:none}</style>
</head><body style="margin:0;background:#0b0f19;color:#e6edf3;font:15px/1.6 Inter,system-ui,Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f19"><tr><td align="center" style="padding:24px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:
radial-gradient(900px 500px at -10% -40%, rgba(245,158,11,.22), transparent 55%),
radial-gradient(900px 600px at 120% 0%,   rgba(34,197,94,.18), transparent 55%),
linear-gradient(180deg,#101934,#0c1226);border:1px solid #27335a;border-radius:16px;overflow:hidden">
  <tr><td style="padding:16px 20px;border-bottom:1px solid #1d2640">
    <table width="100%"><tr>
      <td style="font-weight:800;font-size:16px;color:#e6edf3">
        <img src="${origin}/assets/logo-email.png" width="22" height="22" alt="Cyrptonvest" style="vertical-align:middle;margin-right:8px;display:inline-block">Cyrptonvest
      </td>
      <td align="right" style="color:#9aa4b2;font-size:12px">Welcome aboard</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:22px">
    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3">AI-powered trading. Smart bots. Real results.</h1>
    <p style="margin:0 0 14px;color:#cbd5e1">Hi ${first}, your account is ready. Choose a plan, deposit crypto, and track growth in real time.</p>
    <div style="margin:12px 0 18px">
      <span style="display:inline-block;padding:6px 10px;border:1px solid #2a3a66;background:#0f1a36;border-radius:999px;font-size:12px;color:#d1d5db;margin-right:6px">🤖 AI Bots</span>
      <span style="display:inline-block;padding:6px 10px;border:1px solid #2a3a66;background:#0f1a36;border-radius:999px;font-size:12px;color:#d1d5db;margin-right:6px">📊 Auto-Execution</span>
      <span style="display:inline-block;padding:6px 10px;border:1px solid #2a3a66;background:#0f1a36;border-radius:999px;font-size:12px;color:#d1d5db">⚙️ 24/7</span>
    </div>
    <a href="${dash}" style="display:inline-block;background:linear-gradient(180deg,#fbbf24,#f59e0b);color:#111827;font-weight:800;padding:12px 16px;border-radius:999px">Go to Dashboard</a>
  </td></tr>
  <tr><td style="padding:12px 22px;border-top:1px solid #1d2640;color:#9aa4b2;font-size:12px">© ${new Date().getFullYear()} Cyrptonvest. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`;
      await sendEmail(env, email, "Welcome to Cyrptonvest 🎉", html);
    } catch (e) {
      // Non-fatal; just log
      console.warn("signup email failed:", e);
    }

    return res;
  } catch (err) {
    console.error("signup error:", err);
    return bad("Could not create account. Please try again.", 500);
  }
};
