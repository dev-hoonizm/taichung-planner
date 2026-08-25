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
      const result = await env.DB.prepare("SELECT key, value FROM app_state ORDER BY key").all();
      const data = {};
      for (const row of result.results || []) {
        try { data[row.key] = JSON.parse(row.value); }
        catch { data[row.key] = row.value; }
      }
      return json({ success: true, data });
    }

    if (request.method === "PUT") {
      const body = await readJson(request);
      if (!body || typeof body.key !== "string" || !body.key.trim() || body.key.length > 128 || !("value" in body)) {
        return json({ success: false, error: "A valid key and value are required" }, 400);
      }
      let serialized;
      try { serialized = JSON.stringify(body.value); } catch { return json({ success: false, error: "Value must be JSON serializable" }, 400); }
      if (serialized === undefined || serialized.length > 100000) return json({ success: false, error: "Value is invalid or too large" }, 400);

      await env.DB.prepare(`
        INSERT INTO app_state (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).bind(body.key.trim(), serialized).run();
      return json({ success: true, data: { key: body.key.trim(), value: body.value } });
    }

    return json({ success: false, error: "Method not allowed" }, 405);
  } catch {
    return json({ success: false, error: "Unable to process app state" }, 500);
  }
}
