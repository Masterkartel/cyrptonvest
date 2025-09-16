// functions/api/auth/login.ts
import { json, bad, setCookie, verifyPassword, db, getUserByEmail } from "../../_utils";

export const onRequestPost = async (context: any) => {
  try {
    const { email, password } = await context.request.json();

    if (!email || !password) {
      return bad("Email and password required");
    }

    // look up user in DB
    const user = await getUserByEmail(db, email);
    if (!user) {
      return bad("Invalid credentials");
    }

    // verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return bad("Invalid credentials");
    }

    // create a new session cookie
    const headers = new Headers();
    await setCookie(headers, user.id, context.env);

    return json({ ok: true, user: { id: user.id, email: user.email } }, 200, headers);
  } catch (err: any) {
    return bad("Login failed: " + err.message);
  }
};
