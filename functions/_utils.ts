// Minimal helpers shared by the API

export function json(data: any, status = 200, extraHeaders: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export function bad(msg = "Bad Request", status = 400) {
  return new Response(msg, { status });
}

export function parseCookies(req: Request) {
  const raw = req.headers.get("Cookie") || "";
  const out: Record<string, string> = {};
  raw.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[decodeURIComponent(p.slice(0, i).trim())] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number) {
  return `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearCookie(name: string) {
  return `${encodeURIComponent(name)}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function sha256Hex(input: string) {
  // @ts-ignore - crypto is global in Workers
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string) {
  const salt = crypto.randomUUID();
  const hash = await sha256Hex(`${password}:${salt}`);
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const check = await sha256Hex(`${password}:${salt}`);
  return check === hash;
}
