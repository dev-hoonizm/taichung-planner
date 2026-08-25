const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequest(context) {
  const configuredKey = context.env.TRIP_API_KEY;
  if (!configuredKey) {
    console.warn("TRIP_API_KEY is not configured; API authentication is disabled.");
    return context.next();
  }

  const suppliedKey = context.request.headers.get("X-Trip-Key");
  if (!suppliedKey || suppliedKey !== configuredKey) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  return context.next();
}
