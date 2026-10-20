const CREATED_AT_FIELDS = [
  "createdAt",
  "created_at",
  "createdOn",
  "created_on",
  "dateCreated",
  "date_created",
  "createdDate",
  "created_date",
  "timestamp",
] as const;

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (typeof value === "object" && value !== null) {
    if ("toDate" in value && typeof value.toDate === "function") {
      const date: unknown = value.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
    }

    if ("seconds" in value && typeof value.seconds === "number" && Number.isFinite(value.seconds)) {
      const nanoseconds =
        "nanoseconds" in value && typeof value.nanoseconds === "number" && Number.isFinite(value.nanoseconds)
          ? value.nanoseconds
          : 0;
      const date = new Date(value.seconds * 1000 + nanoseconds / 1_000_000);
      return Number.isFinite(date.getTime()) ? date : null;
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim();
    const numericValue = Number(normalized);
    const date = Number.isFinite(numericValue)
      ? new Date(Math.abs(numericValue) < 1_000_000_000_000 ? numericValue * 1000 : numericValue)
      : new Date(normalized);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  return null;
}

export function getRecordCreatedAt(data: Record<string, unknown>): Date | null {
  for (const field of CREATED_AT_FIELDS) {
    const date = parseDate(data[field]);
    if (date) return date;
  }
  return null;
}
