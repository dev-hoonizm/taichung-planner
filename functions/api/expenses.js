const CURRENCIES = new Set(["TWD", "KRW"]);
const CATEGORIES = new Set(["FOOD", "TRANSPORT", "CAFE", "SHOPPING", "ETC"]);
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
      const result = await env.DB.prepare(`
        SELECT id, amount, currency, category, memo, created_at
        FROM expenses
        ORDER BY created_at DESC, id DESC
      `).all();
      return json({ success: true, data: result.results || [] });
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const amount = Number(body?.amount);
      const currency = String(body?.currency || "");
      const category = String(body?.category || "");
      const memo = body?.memo == null ? "" : String(body.memo).trim();
      if (!Number.isFinite(amount) || amount <= 0) return json({ success: false, error: "Amount must be greater than zero" }, 400);
      if (!CURRENCIES.has(currency)) return json({ success: false, error: "Currency must be TWD or KRW" }, 400);
      if (!CATEGORIES.has(category)) return json({ success: false, error: "Invalid expense category" }, 400);
      if (memo.length > 500) return json({ success: false, error: "Memo is too long" }, 400);

      const result = await env.DB.prepare(`
        INSERT INTO expenses (amount, currency, category, memo)
        VALUES (?, ?, ?, ?)
      `).bind(amount, currency, category, memo).run();
      return json({ success: true, data: { id: result.meta?.last_row_id, amount, currency, category, memo } }, 201);
    }

    if (request.method === "DELETE") {
      const id = Number(new URL(request.url).searchParams.get("id"));
      if (!Number.isInteger(id) || id <= 0) return json({ success: false, error: "A valid expense id is required" }, 400);
      const result = await env.DB.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();
      if (!result.meta?.changes) return json({ success: false, error: "Expense not found" }, 404);
      return json({ success: true, data: { id } });
    }

    return json({ success: false, error: "Method not allowed" }, 405);
  } catch {
    return json({ success: false, error: "Unable to process expenses" }, 500);
  }
}
