import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../firebase';

const functions = getFunctions(auth.app, 'asia-southeast1');
export async function reviewReport(reportId: string, decision: 'verify' | 'reject', reason: string) {
  await httpsCallable(functions, 'reviewVendorReport')({reportId, decision, reason});
}
export async function decideCase(vendorId: string, caseId: string,
  action: 'suspend' | 'resolve' | 'rejectCorrection', reason: string) {
  await httpsCallable(functions, 'decideVendorModeration')({vendorId, caseId, action, reason});
}
export function moderationError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (code.includes('unauthenticated')) return 'Your session has expired. Sign in again.';
    if (code.includes('permission-denied')) return 'Administrator access is required.';
    if (code.includes('failed-precondition') || code.includes('invalid-argument') || code.includes('not-found')) {
      return 'message' in error ? String(error.message) : 'Refresh the records and try again.';
    }
  }
  return 'Could not save this decision. Check your connection and retry.';
}
