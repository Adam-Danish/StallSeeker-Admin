export interface Vendor {
  id?: string;
  vendorId?: string;
  name?: string;
  stallName?: string;
  description?: string;
  category?: string;
  openingHours?: string;
  hours?: string;
  isOpen?: boolean;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  isAccountDisabled?: boolean;
  createdAt?: Date | null;
}

export interface User {
  uid: string;
  email: string;
  fullName: string;
  role: "customer" | "vendor";
  createdAt: any; // Firestore Timestamp
}

export type AdminAction = "suspend" | "reactivate";
