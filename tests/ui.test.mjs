import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("budget tab keeps practical money tools without the estimated budget", () => {
  assert.doesNotMatch(html, /여행 예상 비용|id="budgetList"|id="budgetTotal"|const budgetData/);
  assert.match(html, /id="exchangeRate"/);
  assert.match(html, /id="expenseForm"/);
});

test("completed itinerary cards collapse and expose an accessible expand control", () => {
  assert.match(html, /const expandedCompleted = new Set\(\)/);
  assert.match(html, /data-event-expand="\$\{item\.id\}"/);
  assert.match(html, /aria-expanded="\$\{isExpanded\}"/);
  assert.match(html, /event-card\.completed\.collapsed \.event-details/);
  assert.match(html, /expandedCompleted\.delete\(id\)/);
});
