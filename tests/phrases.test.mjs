import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function extractPhraseRows() {
  const match = html.match(/const phraseData = (\[[\s\S]*?\])\s*\.map\(\(\[id,category,ko,en,zh,pinyin\]\)/);
  assert.ok(match, "phraseData must include the English field in its mapper");
  return Function(`"use strict"; return (${match[1]});`)();
}

test("phrasebook provides complete Korean, English, Chinese and pinyin text", () => {
  const rows = extractPhraseRows();
  assert.equal(rows.length, 42);
  assert.equal(new Set(rows.map(([id]) => id)).size, rows.length, "phrase ids must be unique");
  for (const row of rows) {
    assert.equal(row.length, 6, `${row[0]} must have six fields`);
    assert.ok(row.every(value => typeof value === "string" && value.trim()), `${row[0]} has an empty field`);
  }
});

test("phrasebook renders bilingual speech controls and searchable English", () => {
  assert.match(html, /data-speak-key="\$\{phrase\.id\}:en"/);
  assert.match(html, /data-speak-key="\$\{phrase\.id\}:zh"/);
  assert.match(html, /utterance\.lang = locale/);
  assert.match(html, /`\$\{phrase\.ko\} \$\{phrase\.en\} \$\{phrase\.zh\} \$\{phrase\.pinyin\}/);
  assert.match(html, /id="modalEnglish"/);
  assert.match(html, /id="modalChinese"/);
});
