const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");

initializeApp();

const firestore = getFirestore();
const auth = getAuth();

async function requireAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to access admin activity.");
  }

  const adminProfile = await firestore.doc(`users/${request.auth.uid}`).get();
  const profile = adminProfile.data();
  const role = String(profile?.role ?? profile?.userRole ?? profile?.type ?? "").toLowerCase();

  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Administrator access is required.");
  }

  return {
    uid: request.auth.uid,
    name: String(
      profile?.fullName ??
      profile?.displayName ??
      profile?.name ??
      request.auth.token.name ??
      request.auth.token.email ??
      "Administrator"
    ).slice(0, 120),
    email: String(request.auth.token.email ?? "").slice(0, 254),
  };
}

exports.getVendorEmails = onCall({ region: "us-central1" }, async (request) => {
  await requireAdmin(request);

  const uids = request.data?.uids;
  if (
    !Array.isArray(uids) ||
    uids.length > 100 ||
    uids.some((uid) => typeof uid !== "string" || uid.length === 0 || uid.includes("/"))
  ) {
    throw new HttpsError("invalid-argument", "Provide up to 100 valid vendor user IDs.");
  }

  const emails = await Promise.all(
    [...new Set(uids)].map(async (uid) => {
      const [user, vendor] = await Promise.all([
        firestore.doc(`users/${uid}`).get(),
        firestore.doc(`vendors/${uid}`).get(),
      ]);
      if (!user.exists && !vendor.exists) {
        return { uid, email: null };
      }

      try {
        const authUser = await auth.getUser(uid);
        return { uid, email: authUser.email ?? null };
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          return { uid, email: null };
        }
        throw error;
      }
    })
  );

  return { emails };
});

exports.lookupAccountEmails = onRequest(
  { region: "us-central1", invoker: "public", cors: true },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Use POST to look up account emails." });
      return;
    }

    const authorization = request.get("Authorization") ?? "";
    const tokenMatch = authorization.match(/^Bearer (.+)$/i);
    if (!tokenMatch) {
      response.status(401).json({ error: "Sign in to look up account emails." });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(tokenMatch[1]);
    } catch (error) {
      console.warn("Rejected invalid Firebase ID token for account email lookup:", error);
      response.status(401).json({ error: "Your sign-in has expired. Sign in again." });
      return;
    }

    const adminProfile = await firestore.doc(`users/${decodedToken.uid}`).get();
    const profile = adminProfile.data();
    const role = String(profile?.role ?? profile?.userRole ?? profile?.type ?? "").toLowerCase();
    if (role !== "admin") {
      response.status(403).json({ error: "Administrator access is required." });
      return;
    }

    const uids = request.body?.uids;
    if (
      !Array.isArray(uids) ||
      uids.length > 100 ||
      uids.some((uid) => typeof uid !== "string" || uid.length === 0 || uid.length > 200 || uid.includes("/"))
    ) {
      response.status(400).json({ error: "Provide up to 100 valid account IDs." });
      return;
    }

    try {
      const emails = await Promise.all(
        [...new Set(uids)].map(async (uid) => {
          const [userProfile, vendorProfile] = await Promise.all([
            firestore.doc(`users/${uid}`).get(),
            firestore.doc(`vendors/${uid}`).get(),
          ]);
          if (!userProfile.exists && !vendorProfile.exists) {
            return { uid, email: null };
          }

          try {
            const account = await auth.getUser(uid);
            return { uid, email: account.email ?? null };
          } catch (error) {
            if (error.code === "auth/user-not-found") {
              return { uid, email: null };
            }
            throw error;
          }
        })
      );

      response.status(200).json({ emails });
    } catch (error) {
      console.error("Failed to look up account emails:", error);
      response.status(500).json({ error: "Account emails could not be retrieved." });
    }
  }
);

const ACTIVITY_ACTIONS = new Set([
  "vendor.updated",
  "vendor.deleted",
  "account.disabled",
  "account.enabled",
  "account.deleted",
]);
const ACTIVITY_ENTITY_TYPES = new Set(["vendor", "user"]);

exports.recordAdminActivity = onCall({ region: "us-central1" }, async (request) => {
  const actor = await requireAdmin(request);
  const { action, entityType, entityId, entityName, summary } = request.data ?? {};

  if (
    typeof action !== "string" ||
    !ACTIVITY_ACTIONS.has(action) ||
    typeof entityType !== "string" ||
    !ACTIVITY_ENTITY_TYPES.has(entityType) ||
    typeof entityId !== "string" ||
    entityId.length === 0 ||
    entityId.length > 200 ||
    typeof entityName !== "string" ||
    entityName.length > 200 ||
    typeof summary !== "string" ||
    summary.length === 0 ||
    summary.length > 500
  ) {
    throw new HttpsError("invalid-argument", "Provide valid activity details.");
  }

  await firestore.collection("adminActivity").add({
    action,
    entityType,
    entityId,
    entityName,
    summary,
    actor,
    createdAt: Timestamp.now(),
  });

  return { success: true };
});

exports.getAdminActivity = onCall({ region: "us-central1" }, async (request) => {
  await requireAdmin(request);
  const requestedLimit = Number(request.data?.limit ?? 100);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 200)
    : 100;
  const snapshot = await firestore
    .collection("adminActivity")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return {
    entries: snapshot.docs.map((activity) => {
      const data = activity.data();
      return {
        id: activity.id,
        action: data.action,
        entityType: data.entityType,
        entityName: data.entityName,
        summary: data.summary,
        actorName: data.actor?.name ?? "Administrator",
        actorEmail: data.actor?.email ?? "",
        createdAt: data.createdAt?.toMillis?.() ?? null,
      };
    }),
  };
});
