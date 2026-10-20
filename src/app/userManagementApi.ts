import { auth } from "../firebase";

export type UserManagementAction = "disable" | "enable" | "delete";
export type UserProfileCollection = "users" | "vendors";

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
