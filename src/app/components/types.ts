export interface Vendor {
  vendorId: string;
  stallName: string;
  description: string;
  category: string;
  openingHours: string;
  isOpen: boolean;
  latitude: number;
  longitude: number;
  imageUrl: string;
}

export interface User {
  uid: string;
  email: string;
  fullName: string;
  role: "customer" | "vendor";
  createdAt: any; // Firestore Timestamp
}

export type AdminAction = "suspend" | "reactivate";
