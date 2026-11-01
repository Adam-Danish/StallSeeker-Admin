export interface HistoryPage<T> {
  items: T[];
  nextCursor: string | null;
}

// Load bounded responses so global search, date sorting, and counts include old records too.
export async function loadHistoryPages<T extends { id: string }>(
  fetchPage: (cursor: string | null) => Promise<HistoryPage<T>>,
  options: { signal?: AbortSignal; onProgress?: (count: number) => void } = {}
): Promise<T[]> {
  const records = new Map<string, T>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    options.signal?.throwIfAborted();
    const page = await fetchPage(cursor);
    options.signal?.throwIfAborted();
    if (page.nextCursor !== null && (
      typeof page.nextCursor !== "string" || !page.nextCursor || cursors.has(page.nextCursor)
    )) throw new Error("History service returned an invalid page cursor. Refresh and try again.");
    page.items.forEach((record) => records.set(record.id, record));
    options.onProgress?.(records.size);
    cursor = page.nextCursor;
    if (cursor !== null) cursors.add(cursor);
  } while (cursor !== null);
  return Array.from(records.values());
}
