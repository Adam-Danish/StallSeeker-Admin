import { auth } from "../firebase";
import type { ActivityEvent } from "./components/ActivityLogPage";
import { loadHistoryPages } from "./historyPagination";

export interface ActivityEntry extends ActivityEvent {
  id: string;
  actorName: string;
  actorEmail: string;
  createdAt: number | null;
}

interface ActivityResponse {
  entries?: ActivityEntry[];
  success?: boolean;
  code?: string;
  error?: string;
  paginationVersion?: number;
  nextCursor?: string | null;
}

export class ActivityServiceError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ActivityServiceError";
  }
}

async function requestActivity(
  body: { operation: "list"; limit: number; paginated: true; cursor: string | null } | { operation: "record"; event: ActivityEvent },
  signal?: AbortSignal
): Promise<ActivityResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new ActivityServiceError("unauthenticated", "Sign in to access admin activity.");
  }

  const projectId = auth.app.options.projectId;
  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/adminActivity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  let result: ActivityResponse;
  try {
    result = await response.json() as ActivityResponse;
  } catch {
    throw new Error(`Activity service returned an invalid response (${response.status}).`);
  }

  if (!response.ok) {
    throw new ActivityServiceError(
      result.code ?? `http-${response.status}`,
      result.error ?? `Activity request failed (${response.status}).`
    );
  }

  return result;
}

export async function getAdminActivity(options: {
  signal?: AbortSignal; onProgress?: (count: number) => void;
} = {}): Promise<ActivityEntry[]> {
  return loadHistoryPages(async (cursor) => {
    const result = await requestActivity({ operation: "list", limit: 200, paginated: true, cursor }, options.signal);
    if (result.paginationVersion !== 1 || result.nextCursor === undefined) {
      throw new ActivityServiceError("deployment-required", "Update the activity history service to enable access to all records.");
    }
    if (!Array.isArray(result.entries)) {
      throw new Error("Activity service returned an invalid entries list.");
    }
    return { items: result.entries, nextCursor: result.nextCursor };
  }, options);
}

export async function recordAdminActivity(event: ActivityEvent): Promise<void> {
  const result = await requestActivity({ operation: "record", event });
  if (result.success !== true) {
    throw new Error("The activity service did not confirm the log entry.");
  }
}
