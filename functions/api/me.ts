import { json } from "../_utils";

export const onRequestGet: PagesFunction = async ({ data }) => {
  if (!data.user) return new Response("Unauthorized", { status: 401 });
  return json({ user: data.user });
};
