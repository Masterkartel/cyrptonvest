// functions/api/me.ts
import { json, requireAuth, type Env } from "../_utils";
export const onRequestGet: PagesFunction<Env> = [
  requireAuth,
  async ({ data }) => json({ user: data.user || {} }),
];
