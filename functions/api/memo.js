const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ success: false, error: "D1 binding DB is not configured" }, 500);

  try {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT content, updated_at FROM trip_memo WHERE id = 1").first();
      return json({ success: true, data: row || { content: "" } });
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      if (!body || typeof body.content !== "string") return json({ success: false, error: "Content must be a string" }, 400);
      if (body.content.length > 10000) return json({ success: false, error: "Memo is too long" }, 400);
      await env.DB.prepare(`
        INSERT INTO trip_memo (id, content, updated_at)
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          updated_at = CURRENT_TIMESTAMP
      `).bind(body.content).run();
      return json({ success: true, data: { content: body.content } });
    }

    return json({ success: false, error: "Method not allowed" }, 405);
  } catch {
    return json({ success: false, error: "Unable to process trip memo" }, 500);
  }
}
