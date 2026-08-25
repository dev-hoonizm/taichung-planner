const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }
  if (!context.env.DB) {
    return json({ success: false, error: "D1 binding DB is not configured" }, 500);
  }

  try {
    await context.env.DB.prepare("SELECT 1 AS ok").first();
    return json({ success: true, data: { database: "connected" } });
  } catch {
    return json({ success: false, error: "Database health check failed" }, 500);
  }
}
