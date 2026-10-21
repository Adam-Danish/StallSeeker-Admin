import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase";

export interface BookingHistoryItem {
  id: string;
  data: Record<string, unknown>;
}

interface BookingHistoryResponse {
  bookings?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getBookingHistory(): Promise<BookingHistoryItem[]> {
  const getBookings = httpsCallable<void, BookingHistoryResponse>(
    getFunctions(auth.app, "us-central1"),
    "getBookingHistory"
  );
  const response = await getBookings();
  const bookings = response.data.bookings;
  if (!Array.isArray(bookings)) {
    throw new Error("Booking history service returned an invalid records list.");
  }

  return bookings.map((booking) => {
    if (!isRecord(booking) || typeof booking.id !== "string" || !isRecord(booking.data)) {
      throw new Error("Booking history service returned an invalid record.");
    }

    return { id: booking.id, data: booking.data };
  });
}
