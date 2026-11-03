import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildDirectoryRecords, pageOptions, readDirectoryPage, syncDirectoryAccount } = require("../functions/adminDirectory.js");
const compare = (a, b) => typeof a === "string" ? Buffer.compare(Buffer.from(a), Buffer.from(b)) : a === b ? 0 : a < b ? -1 : 1;

// An immutable Firestore query double. Records and cursors follow Firestore's
// field + document-ID order; every document read is recorded for budget checks.
function directory(documents) {
  const requests = [];
  function query(filters = [], orders = [], after = null, limit = Infinity) {
    return {
      where(field, operator, value) { return query([...filters, { field, operator, value }], orders, after, limit); },
      orderBy(field, direction = "asc") { return query(filters, [...orders, { field, direction }], after, limit); },
      startAfter(...values) { return query(filters, orders, values, limit); },
      limit(value) { assert.ok(value <= 50); return query(filters, orders, after, value); },
      async get() {
        const values = (doc) => orders.map(({ field }) => field === "__name__" ? doc.id : doc.data()[field]);
        const cmp = (a, b) => {
          for (let i = 0; i < orders.length; i++) {
            const result = compare(a[i], b[i]) * (orders[i].direction === "desc" ? -1 : 1);
            if (result) return result;
          }
          return 0;
        };
        const matches = documents.filter((doc) => filters.every(({ field, operator, value }) =>
          operator === "array-contains" ? doc.data()[field].includes(value) : doc.data()[field] === value));
        const docs = matches.sort((a, b) => cmp(values(a), values(b)))
          .filter((doc) => !after || cmp(values(doc), after) > 0).slice(0, limit);
        requests.push({ filters, orders, after, limit, reads: docs.length });
        return { docs, empty: !docs.length };
      },
    };
  }
  return { collection: query(), requests };
}

const document = (id, data) => ({ id, data: () => data });
const account = (id, fields = {}) => document(`account_${id}`, buildDirectoryRecords(id, { name: id, ...fields }, null).account);
const vendor = (id, fields = {}) => document(`vendor_${id}`, buildDirectoryRecords(id, null, { stallName: id, ...fields }).vendor);

test("a users page reads only its requested batch and lookahead, beyond 500 records", async () => {
  const docs = Array.from({ length: 901 }, (_, index) => account(`user-${String(index).padStart(4, "0")}`, { createdAt: 1_700_000_000_000 + index }));
  const { collection, requests } = directory(docs);
  const first = await readDirectoryPage(collection, { kind: "account", pageSize: 25 });
  assert.equal(first.records.length, 25);
  assert.equal(first.records[0].id, "user-0900");
  assert.equal(requests.reduce((sum, request) => sum + request.reads, 0), 26);
  assert.ok(first.nextCursor);
  const second = await readDirectoryPage(collection, { kind: "account", pageSize: 25, cursor: first.nextCursor });
  assert.equal(second.records[0].id, "user-0875");
  assert.equal(new Set([...first.records, ...second.records].map((record) => record.id)).size, 50);
});

test("all sorts traverse ties and undated records without loss; exact-size and empty pages terminate", async () => {
  const docs = Array.from({ length: 60 }, (_, index) => account(`id-${String(index).padStart(3, "0")}`, {
    name: `Vendor ${index}`, createdAt: index < 40 ? 1_700_000_000_000 + Math.floor(index / 2) : null,
  }));
  for (const sort of ["newest", "oldest", "name-asc", "name-desc"]) {
    const { collection } = directory(docs);
    let cursor = null;
    const items = [];
    do {
      const page = await readDirectoryPage(collection, { kind: "account", pageSize: 10, sort, cursor });
      items.push(...page.records);
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(items.length, 60);
    assert.equal(new Set(items.map((item) => item.id)).size, 60);
    if (sort === "newest" || sort === "oldest") assert.ok(items.slice(-20).every((item) => item.createdAt === null));
    if (sort === "name-asc") assert.deepEqual(items.slice(0, 3).map((item) => item.name), ["Vendor 0", "Vendor 1", "Vendor 2"]);
  }
  const empty = await readDirectoryPage(directory([]).collection, { kind: "vendor" });
  assert.deepEqual(empty.records, []);
  assert.equal(empty.nextCursor, null);
});

test("cursor values survive deletion and reject reuse with a different sort, filter, size or search", async () => {
  const docs = Array.from({ length: 31 }, (_, index) => account(`user-${index}`));
  const { collection } = directory(docs);
  const first = await readDirectoryPage(collection, { kind: "account", pageSize: 10 });
  const ids = new Set(first.records.map((record) => record.id));
  docs.splice(docs.findIndex((doc) => doc.data().record.id === first.records.at(-1).id), 1);
  const next = await readDirectoryPage(collection, { kind: "account", pageSize: 10, cursor: first.nextCursor });
  assert.ok(next.records.every((record) => !ids.has(record.id)));
  for (const change of [{ sort: "oldest" }, { pageSize: 50 }, { search: "user" }, { role: "vendor" }, { kind: "vendor" }]) {
    assert.throws(() => pageOptions({ kind: "account", pageSize: 10, cursor: first.nextCursor, ...change }), { code: "invalid-argument" });
  }
  for (const change of [{ cursor: "bad" }, { pageSize: 1000 }, { search: "x".repeat(201) }, { role: "root" }]) {
    assert.throws(() => pageOptions({ kind: "account", ...change }), { code: "invalid-argument" });
  }
});

test("substring search covers older records, filters globally, and bounds false-positive scans", async () => {
  const docs = Array.from({ length: 240 }, (_, index) => account(`user-${String(index).padStart(3, "0")}`, {
    name: index === 235 ? "The Abcdef Stall" : "Abc something else", role: "customer",
  }));
  const { collection, requests } = directory(docs);
  const first = await readDirectoryPage(collection, { kind: "account", search: "abcdef", sort: "name-desc" });
  assert.equal(first.records.length, 1);
  assert.equal(first.records[0].id, "user-235");
  assert.ok(requests.reduce((sum, request) => sum + request.reads, 0) <= 201);
  assert.ok(requests.length <= 5, "sparse searches must not make one request per candidate");
  const limited = await readDirectoryPage(directory(docs).collection, { kind: "account", search: "abc missing" });
  assert.equal(limited.records.length, 0);
  assert.ok(limited.nextCursor, "sparse matches must not be reported as the end of the directory");
  const last = await readDirectoryPage(directory(docs).collection, { kind: "account", search: "abc missing", cursor: limited.nextCursor });
  assert.equal(last.nextCursor, null);
  const listings = [vendor("a", { category: "Food", isOpen: true }), vendor("b", { category: "Food" }), vendor("c", { category: "Drink", isOpen: true })];
  const page = await readDirectoryPage(directory(listings).collection, { kind: "vendor", category: "Food", status: "Open" });
  assert.deepEqual(page.records.map((record) => record.id), ["a"]);
  const filtered = await readDirectoryPage(directory(docs).collection, { kind: "account", role: "admin", search: "abc" });
  assert.equal(filtered.records.length, 0);
});

test("search pages retain matches from an over-fetched candidate batch", async () => {
  const docs = Array.from({ length: 35 }, (_, index) => account(`matching-${String(index).padStart(2, "0")}`));
  const { collection } = directory(docs);
  const ids = [];
  let cursor = null;
  do {
    const page = await readDirectoryPage(collection, { kind: "account", search: "matching", pageSize: 10, cursor });
    assert.ok(page.records.length <= 10);
    ids.push(...page.records.map((record) => record.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(ids.length, 35);
  assert.equal(new Set(ids).size, 35);
});

test("normalization merges matching UIDs, retains roles, phone/email fallbacks and legacy dates", () => {
  const records = buildDirectoryRecords("same", { fullName: "Customer", emailAddress: "user@example.com", mobile_number: 1234 }, {
    stallName: "Vendor", userRole: "admin", created_on: { seconds: 1_700_000_000 }, lat: "3.1", lng: "bad",
  }, "auth@example.com");
  assert.equal(records.account.record.collectionName, "vendors");
  assert.equal(records.account.record.role, "admin");
  assert.equal(records.account.record.email, "user@example.com");
  assert.equal(records.account.record.phoneNumber, "1234");
  assert.equal(records.vendor.record.createdAt, 1_700_000_000_000);
  assert.equal(records.vendor.record.latitude, 3.1);
  assert.equal(records.vendor.record.longitude, 0);
  assert.equal(buildDirectoryRecords("same", { name: "User" }, null, "auth@example.com").account.record.email, "auth@example.com");
  assert.equal(buildDirectoryRecords("same", { name: "User" }, null).account.dateMissing, true);
  assert.deepEqual(buildDirectoryRecords("same", null, null), {});
  assert.equal(buildDirectoryRecords("date", { createdAt: "invalid", timestamp: "2020-01-01" }, null).account.dateSort, Date.parse("2020-01-01"));
});

test("directory synchronization is idempotent and re-reads current profiles after delayed events", async () => {
  const documents = new Map([["users/uid", { name: "User", email: "u@example.com" }], ["vendors/uid", { stallName: "Stall", category: "Food" }]]);
  const firestore = {
    doc(path) { return { path }; },
    async runTransaction(callback) {
      const writes = [];
      await callback({
        async getAll(...refs) { return refs.map((ref) => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) })); },
        set(ref, data) { writes.push(() => documents.set(ref.path, data)); },
        delete(ref) { writes.push(() => documents.delete(ref.path)); },
      });
      writes.forEach((write) => write());
    },
  };
  const auth = { async getUser() { return { email: "auth@example.com" }; } };
  await syncDirectoryAccount(firestore, auth, "uid");
  await syncDirectoryAccount(firestore, auth, "uid");
  let facets = [...documents].filter(([path]) => path.startsWith("adminDirectoryCategories/"));
  assert.equal(facets[0][1].count, 1);
  documents.set("vendors/uid", { stallName: "Updated", category: "Drink" });
  await syncDirectoryAccount(firestore, auth, "uid");
  facets = [...documents].filter(([path]) => path.startsWith("adminDirectoryCategories/"));
  assert.deepEqual(facets.map(([, value]) => value), [{ category: "Drink", count: 1 }]);
  documents.delete("vendors/uid");
  await syncDirectoryAccount(firestore, auth, "uid");
  assert.equal(documents.get("adminDirectory/account_uid").record.collectionName, "users");
  assert.equal(documents.has("adminDirectory/vendor_uid"), false);
  assert.equal([...documents.keys()].some((path) => path.startsWith("adminDirectoryCategories/")), false);
  documents.delete("users/uid");
  await syncDirectoryAccount(firestore, auth, "uid");
  assert.equal(documents.has("adminDirectory/account_uid"), false);
});

test("deployed indexes cover every supported filter/search/sort combination", async () => {
  const { indexes } = JSON.parse(readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8"));
  for (const kind of ["account", "vendor"]) {
    const filters = kind === "account" ? [{}, { role: "admin" }] : [{}, { status: "Open" }, { category: "Food" }, { category: "Food", status: "Closed" }];
    for (const filter of filters) for (const search of ["", "stall"]) for (const sort of ["newest", "oldest", "name-asc", "name-desc"]) {
      const { collection, requests } = directory([]);
      await readDirectoryPage(collection, { kind, ...filter, search, sort });
      const request = requests[0];
      const fields = [
        ...request.filters.map(({ field, operator }) => ({ fieldPath: field, ...(operator === "array-contains" ? { arrayConfig: "CONTAINS" } : { order: "ASCENDING" }) })),
        ...request.orders.map(({ field, direction }) => ({ fieldPath: field, order: direction === "asc" ? "ASCENDING" : "DESCENDING" })),
      ];
      assert.ok(indexes.some((index) => JSON.stringify(index.fields) === JSON.stringify(fields)), JSON.stringify({ kind, ...filter, search, sort }));
    }
  }
});

test("directory endpoint rejects unauthenticated, non-admin and unprepared requests", async () => {
  let isAdmin = false;
  let ready = false;
  const firestore = {
    doc(path) { return { async get() { return { data: () => path === "adminDirectoryMeta/state" ? { version: 1, ready } : { role: isAdmin ? "admin" : "customer" } }; } }; },
  };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const exports = {};
  const dependencies = {
    "firebase-admin/app": { initializeApp() {} },
    "firebase-admin/firestore": { getFirestore: () => firestore, Timestamp: {} },
    "firebase-admin/auth": { getAuth: () => ({}) },
    "firebase-functions/v2/https": { HttpsError, onCall: (_, handler) => handler, onRequest: (_, handler) => handler },
    "firebase-functions/v2/firestore": { onDocumentWritten: (_, handler) => handler },
    "./adminDirectory": require("../functions/adminDirectory.js"),
    "./historyPagination": require("../functions/historyPagination.js"),
  };
  new Function("require", "exports", readFileSync(new URL("../functions/index.js", import.meta.url), "utf8"))((name) => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, exports);
  await assert.rejects(exports.getAdminDirectoryPage({}), { code: "unauthenticated" });
  await assert.rejects(exports.getAdminDirectoryPage({ auth: { uid: "caller", token: {} } }), { code: "permission-denied" });
  isAdmin = true;
  await assert.rejects(exports.getAdminDirectoryPage({ auth: { uid: "caller", token: {} } }), { code: "failed-precondition" });
});
