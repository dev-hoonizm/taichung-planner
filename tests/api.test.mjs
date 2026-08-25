import test from "node:test";
import assert from "node:assert/strict";

import { onRequest as health } from "../functions/api/health.js";
import { onRequest as state } from "../functions/api/state.js";
import { onRequest as expenses } from "../functions/api/expenses.js";
import { onRequest as memo } from "../functions/api/memo.js";
import { onRequest as auth } from "../functions/api/_middleware.js";
import worker from "../src/worker.js";

function createDb(options = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      const statement = {
        async first() {
          if (normalized.includes("SELECT content")) return options.memoRow ?? null;
          return { ok: 1 };
        },
        async all() {
          if (normalized.includes("FROM app_state")) return { results: options.stateRows || [] };
          if (normalized.includes("FROM expenses")) return { results: options.expenseRows || [] };
          return { results: [] };
        },
        bind(...values) {
          calls.push({ sql: normalized, values });
          return {
            async run() { return { meta: { changes: options.changes ?? 1, last_row_id: options.lastRowId ?? 7 } }; }
          };
        }
      };
      return statement;
    }
  };
}

async function body(response) { return response.json(); }

test("health reports missing D1 binding and connected D1", async () => {
  const missing = await health({ request: new Request("https://test/api/health"), env: {} });
  assert.equal(missing.status, 500);
  assert.equal((await body(missing)).error, "D1 binding DB is not configured");

  const connected = await health({ request: new Request("https://test/api/health"), env: { DB: createDb() } });
  assert.equal(connected.status, 200);
  assert.deepEqual(await body(connected), { success: true, data: { database: "connected" } });
});

test("state GET parses JSON and PUT uses bound values", async () => {
  const db = createDb({ stateRows: [{ key: "checklist", value: "[1,2]" }] });
  const getResponse = await state({ request: new Request("https://test/api/state"), env: { DB: db } });
  assert.deepEqual((await body(getResponse)).data, { checklist: [1, 2] });

  const putResponse = await state({
    request: new Request("https://test/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "budget", value: { food: 10 } }) }),
    env: { DB: db }
  });
  assert.equal(putResponse.status, 200);
  assert.deepEqual(db.calls.at(-1).values, ["budget", '{"food":10}']);
});

test("expenses rejects invalid enums and inserts with bindings", async () => {
  const db = createDb({ lastRowId: 42 });
  const invalid = await expenses({
    request: new Request("https://test/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: 180, currency: "USD", category: "FOOD" }) }),
    env: { DB: db }
  });
  assert.equal(invalid.status, 400);

  const valid = await expenses({
    request: new Request("https://test/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: 180, currency: "TWD", category: "FOOD", memo: "night market" }) }),
    env: { DB: db }
  });
  assert.equal(valid.status, 201);
  assert.equal((await body(valid)).data.id, 42);
  assert.deepEqual(db.calls.at(-1).values, [180, "TWD", "FOOD", "night market"]);
});

test("memo returns an empty singleton and PUT binds content", async () => {
  const db = createDb({ memoRow: null });
  const getResponse = await memo({ request: new Request("https://test/api/memo"), env: { DB: db } });
  assert.deepEqual((await body(getResponse)).data, { content: "" });

  const putResponse = await memo({
    request: new Request("https://test/api/memo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "Uber 이용" }) }),
    env: { DB: db }
  });
  assert.equal(putResponse.status, 200);
  assert.deepEqual(db.calls.at(-1).values, ["Uber 이용"]);
});

test("middleware rejects a wrong key and allows a correct key", async () => {
  const rejected = await auth({ request: new Request("https://test/api/health", { headers: { "X-Trip-Key": "wrong" } }), env: { TRIP_API_KEY: "correct" }, next: () => new Response("next") });
  assert.equal(rejected.status, 401);
  assert.equal((await body(rejected)).error, "Unauthorized");

  const accepted = await auth({ request: new Request("https://test/api/health", { headers: { "X-Trip-Key": "correct" } }), env: { TRIP_API_KEY: "correct" }, next: () => new Response("next") });
  assert.equal(await accepted.text(), "next");
});

test("worker routes APIs through authentication and delegates assets", async () => {
  const executionContext = {
    waitUntil() {},
    passThroughOnException() {}
  };
  const env = {
    DB: createDb(),
    TRIP_API_KEY: "correct",
    ASSETS: {
      fetch(request) { return new Response(`asset:${new URL(request.url).pathname}`); }
    }
  };

  const rejected = await worker.fetch(new Request("https://test/api/health"), env, executionContext);
  assert.equal(rejected.status, 401);

  const accepted = await worker.fetch(new Request("https://test/api/health", { headers: { "X-Trip-Key": "correct" } }), env, executionContext);
  assert.equal(accepted.status, 200);
  assert.equal((await body(accepted)).data.database, "connected");

  const unknown = await worker.fetch(new Request("https://test/api/unknown", { headers: { "X-Trip-Key": "correct" } }), env, executionContext);
  assert.equal(unknown.status, 404);

  const asset = await worker.fetch(new Request("https://test/"), env, executionContext);
  assert.equal(await asset.text(), "asset:/");
});
