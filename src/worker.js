import { onRequest as authenticate } from "../functions/api/_middleware.js";
import { onRequest as health } from "../functions/api/health.js";
import { onRequest as state } from "../functions/api/state.js";
import { onRequest as expenses } from "../functions/api/expenses.js";
import { onRequest as memo } from "../functions/api/memo.js";

const apiRoutes = new Map([
  ["/api/health", health],
  ["/api/state", state],
  ["/api/expenses", expenses],
  ["/api/memo", memo]
]);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }
});

export default {
  async fetch(request, env, executionContext) {
    const pathname = new URL(request.url).pathname;
    const handler = apiRoutes.get(pathname);

    if (handler) {
      const context = {
        request,
        env,
        waitUntil: executionContext.waitUntil.bind(executionContext),
        passThroughOnException: executionContext.passThroughOnException.bind(executionContext),
        next: () => handler({ request, env })
      };
      return authenticate(context);
    }

    if (pathname.startsWith("/api/")) {
      return json({ success: false, error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
