import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  validateRejectionNote,
  validateTransferReference,
  type VendorPayoutDetailsRecord,
} from "./payoutUtils";

function requireAdminActor() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Your administrator session has expired. Sign in again.");
  }
  return {
    uid: user.uid,
    email: (user.email ?? "").slice(0, 254),
  };
}

export async function settlePayoutRequest(params: {
  payoutId: string;
  transferReference: string;
  adminNote?: string;
}): Promise<void> {
  const actor = requireAdminActor();
  const refError = validateTransferReference(params.transferReference);
  if (refError) throw new Error(refError);

  await updateDoc(doc(db, "vendorPayouts", params.payoutId), {
    status: "paid",
    transferReference: params.transferReference.trim(),
    adminNote: (params.adminNote ?? "").trim().slice(0, 240),
    settledByUid: actor.uid,
    settledByEmail: actor.email,
    settledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function rejectPayoutRequest(params: {
  payoutId: string;
  adminNote: string;
}): Promise<void> {
  const actor = requireAdminActor();
  const noteError = validateRejectionNote(params.adminNote);
  if (noteError) throw new Error(noteError);

  await updateDoc(doc(db, "vendorPayouts", params.payoutId), {
    status: "rejected",
    transferReference: "",
    adminNote: params.adminNote.trim().slice(0, 240),
    settledByUid: actor.uid,
    settledByEmail: actor.email,
    settledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function recordDirectVendorPayout(params: {
  vendorId: string;
  stallName: string;
  bankDetails: VendorPayoutDetailsRecord;
  amountCents: number;
  transferReference: string;
  adminNote?: string;
}): Promise<void> {
  const actor = requireAdminActor();
  if (!Number.isInteger(params.amountCents) || params.amountCents < 100 || params.amountCents > 50_000_000) {
    throw new Error("Enter a valid payout amount between RM 1.00 and RM 500,000.00.");
  }
  const refError = validateTransferReference(params.transferReference);
  if (refError) throw new Error(refError);

  await addDoc(collection(db, "vendorPayouts"), {
    vendorId: params.vendorId,
    stallName: params.stallName.trim().slice(0, 160),
    amountCents: params.amountCents,
    status: "paid",
    bankName: params.bankDetails.bankName,
    accountHolderName: params.bankDetails.accountHolderName,
    accountNumber: params.bankDetails.accountNumber,
    duitNowId: params.bankDetails.duitNowId,
    vendorNote: "",
    transferReference: params.transferReference.trim(),
    adminNote: (params.adminNote ?? "").trim().slice(0, 240),
    requestedBy: actor.uid,
    requestedAt: serverTimestamp(),
    settledByUid: actor.uid,
    settledByEmail: actor.email,
    settledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
