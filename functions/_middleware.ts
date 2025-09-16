// functions/_middleware.ts
// Fail-open middleware: never crash the worker.
export const onRequest: PagesFunction[] = [
  async (ctx) => {
    try {
      // If you had previous logic (auth/session), keep it inside this try.
      // Example: only touch /api/* paths, never static pages.
      const url = new URL(ctx.request.url);
      if (url.pathname.startsWith("/api/")) {
        // Place your existing API middleware bits here (cookies, session etc.)
        // Keep everything in try/catch, but if anything fails, we still call next().
      }
    } catch {
      // swallow – fail open
    }
    return ctx.next();
  },
];
