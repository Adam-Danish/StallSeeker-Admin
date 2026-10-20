import { auth } from "../firebase";

export type UserManagementAction = "disable" | "enable" | "delete";
export type UserProfileCollection = "users" | "vendors";

interface AccountMetadataResponse {
  emails?: Array<{ uid: string; createdAt?: string | null }>;
  error?: string;
}

interface UserManagementResponse {
  success?: boolean;
  code?: string;
  error?: string;
  authAccountUpdated?: boolean;
}

export class UserManagementError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "UserManagementError";
  }
}

export async function lookupAccountCreationDates(accountIds: string[]): Promise<Map<string, Date>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new UserManagementError("unauthenticated", "Sign in with a Firebase admin account to load vendor registration dates.");
  }

  const projectId = auth.app.options.projectId;
  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/lookupAccountEmails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ uids: accountIds }),
  });

  let result: AccountMetadataResponse;
  try {
    result = await response.json() as AccountMetadataResponse;
  } catch {
    throw new Error(`Account registration date lookup returned an invalid response (${response.status}).`);
  }

  if (!response.ok || !Array.isArray(result.emails)) {
    throw new Error(result.error ?? `Account registration date lookup failed (${response.status}).`);
  }
  if (result.emails.some((account) => !("createdAt" in account))) {
    throw new Error("The deployed account lookup function is outdated. Deploy the updated lookupAccountEmails function.");
  }

  const dates = new Map<string, Date>();
  result.emails.forEach(({ uid, createdAt }) => {
    if (!createdAt) return;
    const date = new Date(createdAt);
    if (Number.isFinite(date.getTime())) dates.set(uid, date);
  });
  if (dates.size === 0 && accountIds.length > 0) {
    throw new Error("Firebase returned no account creation dates. Confirm vendor document IDs match their Firebase Authentication UIDs.");
  }
  return dates;
}

export async function performUserManagementAction(
  action: UserManagementAction,
  collectionName: UserProfileCollection,
  accountId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new UserManagementError("unauthenticated", "Sign in with a Firebase admin account to manage users.");
  }

  const projectId = auth.app.options.projectId;
  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/adminUserAction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action, collectionName, accountId }),
  });

  let result: UserManagementResponse;
  try {
    result = await response.json() as UserManagementResponse;
  } catch {
    throw new Error(`Account management service returned an invalid response (${response.status}).`);
  }

  if (!response.ok || result.success !== true) {
    throw new UserManagementError(
      result.code ?? `http-${response.status}`,
      result.error ?? `Account action failed (${response.status}).`
    );
  }
}
