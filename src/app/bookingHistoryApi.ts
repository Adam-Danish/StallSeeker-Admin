import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase";
import { loadHistoryPages } from "./historyPagination";

export interface BookingHistoryItem {
  id: string;
  data: Record<string, unknown>;
}

export async function downloadBookingReceipt(bookingId: string): Promise<void> {
  const getReceipt = httpsCallable<{ bookingId: string }, { pdfBase64: string; filename: string }>(
    getFunctions(auth.app, "us-central1"), "getBookingReceipt"
  );
  const { data } = await getReceipt({ bookingId });
  const bytes = Uint8Array.from(atob(data.pdfBase64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = data.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface BookingHistoryResponse {
  bookings?: unknown;
  paginationVersion?: number;
  nextCursor?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getBookingHistory(options: {
  signal?: AbortSignal; onProgress?: (count: number) => void;
} = {}): Promise<BookingHistoryItem[]> {
  const getBookings = httpsCallable<{ paginated: true; limit: number; cursor: string | null }, BookingHistoryResponse>(
    getFunctions(auth.app, "us-central1"),
    "getBookingHistory"
  );
  return loadHistoryPages(async (cursor) => {
    const response = await getBookings({ paginated: true, limit: 200, cursor });
    if (response.data.paginationVersion !== 1 || response.data.nextCursor === undefined) {
      throw new Error("Update the booking history service to enable access to all records.");
    }
    const bookings = response.data.bookings;
    if (!Array.isArray(bookings)) {
      throw new Error("Booking history service returned an invalid records list.");
    }

    const items = bookings.map((booking) => {
      if (!isRecord(booking) || typeof booking.id !== "string" || !isRecord(booking.data)) {
        throw new Error("Booking history service returned an invalid record.");
      }

      return { id: booking.id, data: booking.data };
    });
    return { items, nextCursor: response.data.nextCursor };
  }, options);
}
