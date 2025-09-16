// functions/api/auth/forgot.ts
import { json, bad, getUserByEmail } from "../../_utils";

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { email } = await ctx.request.json<{ email: string }>();
    if (!email) return bad("Email required");

    // Find user
    const user = await getUserByEmail(ctx.env, email);
    if (!user) return json({ ok: true }); // don’t reveal non-existence

    // Create token
    const token = crypto.randomUUID();
    await ctx.env.DB.prepare(
      "INSERT INTO password_resets (user_id, token, created_at) VALUES (?, ?, ?)"
    )
      .bind(user.id, token, Date.now())
      .run();

    // Build reset link
    const link = `https://cyrptonvest.com/reset-password?token=${token}`;

    // Send email via Resend
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Cyrptonvest <noreply@cyrptonvest.com>",
        to: [email],
        subject: "Reset your Cyrptonvest password",
        html: `<p>Click the link below to reset your password:</p>
               <p><a href="${link}">${link}</a></p>
               <p>If you didn’t request this, ignore this email.</p>`,
      }),
    });

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return bad("Something went wrong", 500);
  }
};
