// functions/api/me.ts
export const onRequestGet: PagesFunction = async ({ data }) => {
  if (!data.user) return new Response('Unauthorized', { status: 401 });
  return Response.json({ user: data.user });
};
