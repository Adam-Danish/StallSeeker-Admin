import { auth } from "../firebase";
import type { ActivityEvent } from "./components/ActivityLogPage";

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
  body: { operation: "list"; limit: number } | { operation: "record"; event: ActivityEvent }
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

export async function getAdminActivity(limit: number): Promise<ActivityEntry[]> {
  const result = await requestActivity({ operation: "list", limit });
  if (!Array.isArray(result.entries)) {
    throw new Error("Activity service returned an invalid entries list.");
  }
  return result.entries;
}

export async function recordAdminActivity(event: ActivityEvent): Promise<void> {
  const result = await requestActivity({ operation: "record", event });
  if (result.success !== true) {
    throw new Error("The activity service did not confirm the log entry.");
  }
}
