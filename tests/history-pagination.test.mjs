import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { readHistoryPage } = require("../functions/historyPagination.js");

function loadTypeScript(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(require, module, module.exports);
  return module.exports;
}

const { loadHistoryPages } = loadTypeScript("../src/app/historyPagination.ts");
const { sortRecords } = loadTypeScript("../src/app/useRecordPagination.ts");
const compareIds = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

// Match Firestore's ID ordering and cursor/limit behavior without credentials or live writes.
function collection(documents) {
  return {
    orderBy(field) {
      assert.equal(field, "__name__");
      let cursor = null;
      let limit;
      const query = {
        startAfter(value) { cursor = value; return query; },
        limit(value) { assert.ok(value <= 201); limit = value; return query; },
        async get() {
          return { docs: documents.filter((doc) => cursor === null || compareIds(doc.id, cursor) > 0)
            .sort((a, b) => compareIds(a.id, b.id)).slice(0, limit) };
        },
      };
      return query;
    },
  };
}

test("history reaches beyond 500 records, deduplicates collections, and prefers current bookings", async () => {
  const legacy = Array.from({ length: 650 }, (_, i) => ({ id: `booking-${String(i).padStart(4, "0")}`, source: "legacy" }));
  const current = Array.from({ length: 700 }, (_, i) => ({ id: `booking-${String(i + 450).padStart(4, "0")}`, source: "current" }));
  const records = await loadHistoryPages(async (cursor) => {
    const page = await readHistoryPage([collection(legacy), collection(current)], { cursor, limit: 37 });
    assert.ok(page.docs.length <= 37);
    return { items: page.docs, nextCursor: page.nextCursor };
  });
  assert.equal(records.length, 1150);
  assert.equal(records.find((r) => r.id === "booking-0600").source, "current");
  assert.equal(records.at(-1).id, "booking-1149");
});

test("empty and exact-size histories terminate; ID cursors include undated and Unicode records", async () => {
  assert.deepEqual(await readHistoryPage([collection([])]), { docs: [], nextCursor: null });
  const docs = ["A", "Z", "a", "é", "😀", "\uE000"].map((id) => ({ id }));
  const records = await loadHistoryPages(async (cursor) => {
    const page = await readHistoryPage([collection(docs)], { cursor, limit: 2 });
    return { items: page.docs, nextCursor: page.nextCursor };
  });
  assert.deepEqual(records.map((r) => r.id), docs.map((r) => r.id).sort(compareIds));
  assert.equal((await readHistoryPage([collection(docs)], { limit: 6 })).nextCursor, null);
  await assert.rejects(readHistoryPage([collection(docs)], { cursor: "invalid/path" }), { code: "invalid-argument" });
});

test("a deleted cursor record does not prevent reading later records", async () => {
  const docs = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const first = await readHistoryPage([collection(docs)], { limit: 1 });
  docs.shift();
  const second = await readHistoryPage([collection(docs)], { limit: 1, cursor: first.nextCursor });
  assert.equal(second.docs[0].id, "b");
});

test("history loader rejects repeated cursors and failures rather than returning incomplete counts", async () => {
  await assert.rejects(loadHistoryPages(async () => ({ items: [], nextCursor: "repeated" })), /invalid page cursor/);
  let calls = 0;
  await assert.rejects(loadHistoryPages(async () => {
    if (++calls === 2) throw new Error("network failure");
    return { items: [{ id: "a" }], nextCursor: "a" };
  }), /network failure/);
});

test("leaving history cancels further requests and progress updates", async () => {
  const controller = new AbortController();
  let progress = 0;
  await assert.rejects(loadHistoryPages(async () => {
    controller.abort();
    return { items: [{ id: "a" }], nextCursor: "a" };
  }, { signal: controller.signal, onProgress: () => progress++ }), { name: "AbortError" });
  assert.equal(progress, 0);
});

test("date sorting keeps missing dates last and ties stable in both directions", () => {
  const records = [
    { id: "missing", name: "Missing", date: null },
    { id: "b", name: "Vendor 10", date: new Date(2000) },
    { id: "a", name: "Vendor 2", date: 2000 },
    { id: "old", name: "Old", date: 1000 },
    { id: "invalid", name: "Invalid", date: new Date("invalid") },
  ];
  const ids = (sort) => sortRecords(records, sort, (r) => r).map((r) => r.id);
  assert.deepEqual(ids("newest"), ["a", "b", "old", "invalid", "missing"]);
  assert.deepEqual(ids("oldest"), ["old", "a", "b", "invalid", "missing"]);
  assert.deepEqual(ids("name-asc"), ["invalid", "missing", "old", "a", "b"]);
  assert.deepEqual(ids("name-desc"), ["b", "a", "old", "missing", "invalid"]);
  assert.equal(records[0].id, "missing");
});
