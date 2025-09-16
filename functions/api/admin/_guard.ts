export function ensureAdmin(c: any) {
  const user = c.get('user'); // set by _middleware
  if (!user || user.email?.toLowerCase() !== 'support@cyrptonvest.com') {
    return c.json({ error: 'forbidden' }, 401);
  }
  return null;
}
