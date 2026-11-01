/** Merge collections by document ID; later collections take precedence for duplicates. */
async function readHistoryPage(collections, options = {}) {
  const requestedLimit = Number(options.limit ?? 200);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 200;
  const cursor = options.cursor ?? null;
  if (cursor !== null && (typeof cursor !== "string" || !cursor || cursor.includes("/") || Buffer.byteLength(cursor, "utf8") > 1500)) {
    const error = new Error("Invalid history cursor.");
    error.code = "invalid-argument";
    throw error;
  }
  const snapshots = await Promise.all(collections.map((collection) => {
    // Document IDs cover legacy documents even when their date fields are absent.
    let query = collection.orderBy("__name__");
    if (cursor !== null) query = query.startAfter(cursor);
    return query.limit(limit + 1).get();
  }));
  const byId = new Map();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((doc) => byId.set(doc.id, doc)));
  const docs = Array.from(byId.values()).sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)));
  const page = docs.slice(0, limit);
  return { docs: page, nextCursor: docs.length > limit ? page[page.length - 1].id : null };
}

module.exports = { readHistoryPage };
