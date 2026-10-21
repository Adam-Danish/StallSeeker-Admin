import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Map as MapIcon,
  History,
  CalendarDays,
  Moon,
  Sun,
  LogOut,
  Store,
  Users,
  Search,
  Filter,
  Phone,
  Trash2,
  UserX,
  UserCheck
} from "lucide-react";
import { collection, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { getRecordCreatedAt } from "./dateUtils";
import { AdminDashboard } from "./components/AdminDashboard";
import { AnalyticsPage } from "./components/AnalyticsPage";
import { ActivityLogPage, type ActivityEvent } from "./components/ActivityLogPage";
import { BookingHistoryPage } from "./components/BookingHistoryPage";
import { recordAdminActivity } from "./adminActivityApi";
import {
  lookupAccountCreationDates,
  performUserManagementAction,
  type UserProfileCollection,
} from "./userManagementApi";
import { AdminLogin } from "./components/AdminLogin";
import type { DashboardVendor } from "./components/DashboardCharts";
import { MonitorVendors } from "./components/MonitorVendors";
import { VendorDetail } from "./components/VendorDetail";
import { ActionConfirmation } from "./components/ActionConfirmation";
import { LiveVendorMap } from "./LiveMap";
import type { Vendor, AdminAction } from "./components/types";

interface UserAccount {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  collectionName: UserProfileCollection;
  createdAt: Date | null;
  role?: 'customer' | 'vendor' | 'admin';
  isAccountDisabled?: boolean;
}

type Screen = "dashboard" | "analytics" | "map" | "activity-log" | "booking-history" | "vendors" | "users" | "vendor-detail" | "action-confirm";
type NavTab = "dashboard" | "analytics" | "map" | "activity-log" | "booking-history" | "vendors" | "users";

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "No Email Provided";
}

function firstNonEmptyValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function firstImageUrl(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function AdminDashboardApp({
  previewMode = false,
  onPreviewSignOut,
}: {
  previewMode?: boolean;
  onPreviewSignOut?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [darkMode, setDarkMode] = useState(
    () => window.localStorage.getItem("stallseeker-admin-theme") === "dark"
  );
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    window.localStorage.setItem("stallseeker-admin-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleSignOut = async () => {
    if (previewMode) {
      onPreviewSignOut?.();
      return;
    }

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Unable to sign out of the admin dashboard:", error);
      setSignOutError("Unable to sign out. Please try again.");
    }
  };

  // Data State
  const [vendorsList, setVendorsList] = useState<Vendor[]>([]);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [authCreatedAtByUid, setAuthCreatedAtByUid] = useState<Record<string, Date>>({});
  const [analyticsDateLookupError, setAnalyticsDateLookupError] = useState<string | null>(null);
  const attemptedAnalyticsDateLookups = useRef(new Set<string>());
  const [emailLookupError, setEmailLookupError] = useState<string | null>(null);
  const [activityNotice, setActivityNotice] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [activeUserActionId, setActiveUserActionId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [pendingAction, setPendingAction] = useState<AdminAction>("suspend");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [userTypeFilter, setUserTypeFilter] = useState<"all" | "customers" | "vendors" | "admins">("all");

  // Edit Listing State
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // 1. Fetch Vendors Real-time
  useEffect(() => {
    if (previewMode) return;

    const unsubscribe = onSnapshot(collection(db, "vendors"), (snapshot) => {
      const docs: Vendor[] = snapshot.docs.map((d) => {
        const data = d.data();
        const latitude = Number(data.latitude ?? data.lat ?? 0);
        const longitude = Number(data.longitude ?? data.lng ?? 0);

        return {
          id: d.id,
          vendorId: d.id,
          name: data.name || data.stallName || "Unknown",
          stallName: data.stallName || data.name || "Unknown",
          description: data.description || "",
          category: data.category || "Unknown",
          openingHours: data.openingHours || data.hours || "",
          hours: data.hours || data.openingHours || "",
          isOpen: Boolean(data.isOpen),
          latitude: Number.isFinite(latitude) ? latitude : 0,
          longitude: Number.isFinite(longitude) ? longitude : 0,
          lat: Number.isFinite(latitude) ? latitude : 0,
          lng: Number.isFinite(longitude) ? longitude : 0,
          imageUrl: firstImageUrl(
            data.profileImageUrl,
            data.profilePictureUrl,
            data.photoURL,
            data.photoUrl,
            data.imageUrl,
            data.imageURL,
            data.image
          ),
          profileImageUrl: firstImageUrl(
            data.profileImageUrl,
            data.profilePictureUrl,
            data.photoURL,
            data.photoUrl,
            data.imageUrl,
            data.imageURL,
            data.image
          ),
          phoneNumber: firstNonEmptyValue(
            data.phoneNumber,
            data.phone_number,
            data.phone,
            data.mobileNumber,
            data.mobile_number,
            data.mobile,
            data.contactNumber,
            data.contact_number,
            data.telephone,
            data.contact
          ),
          isAccountDisabled: Boolean(data.isAccountDisabled),
          createdAt: getRecordCreatedAt(data),
        } as Vendor & { isAccountDisabled?: boolean };
      });
      setVendorsList(docs);
    });
    return () => unsubscribe();
  }, [previewMode]);

  // 2. Fetch both "users" AND "vendors" collections and merge/cross-reference email
  useEffect(() => {
    if (previewMode) return;

    let customerAccounts: UserAccount[] = [];
    let vendorAccounts: UserAccount[] = [];
    const authEmails = new Map<string, string>();
    const attemptedEmailLookups = new Set<string>();
    const pendingEmailLookups = new Set<string>();
    let isActive = true;
    const lookupAccountEmails = async (uids: string[]) => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Sign in with an administrator account to retrieve account emails.");
      }

      const projectId = auth.app.options.projectId;
      if (!projectId) {
        throw new Error("Firebase project ID is not configured.");
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(
        `https://us-central1-${projectId}.cloudfunctions.net/lookupAccountEmails`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ uids }),
        }
      );
      const result = await response.json() as {
        emails?: Array<{ uid: string; email: string | null }>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || `Account email lookup failed (${response.status}).`);
      }
      if (!Array.isArray(result.emails)) {
        throw new Error("Account email lookup returned an invalid response.");
      }

      return result.emails;
    };

    const updateCombinedList = () => {
      // Map user accounts by ID for fast email lookup.
      const resolvedCustomers = customerAccounts.map((user) => ({
        ...user,
        email: user.email !== "No Email Provided"
          ? user.email
          : authEmails.get(user.id) || "No Email Provided",
      }));
      const userMap = new Map(resolvedCustomers.map((user) => [user.id, user]));

      const resolvedVendors = vendorAccounts.map((v) => {
        const matchingUser = userMap.get(v.id);
        const resolvedEmail = v.email !== "No Email Provided"
          ? v.email
          : authEmails.get(v.id) || matchingUser?.email || "No Email Provided";

        return {
          ...v,
          email: resolvedEmail,
          phoneNumber: v.phoneNumber || matchingUser?.phoneNumber || "",
        };
      });

      // Combine both lists into a single map (prioritizing vendor roles when matching)
      const finalMap = new Map<string, UserAccount>();
      [...resolvedCustomers, ...resolvedVendors].forEach((acc) => finalMap.set(acc.id, acc));
      const combinedAccounts = Array.from(finalMap.values());
      setUsersList(combinedAccounts);

      const missingEmailUids = combinedAccounts
        .filter((account) => {
          const emailMissing = !account.email || account.email === "No Email Provided";
          return emailMissing &&
            !authEmails.has(account.id) &&
            !attemptedEmailLookups.has(account.id) &&
            !pendingEmailLookups.has(account.id);
        })
        .map((account) => account.id)
        .slice(0, 100);

      if (!missingEmailUids.length) return;

      missingEmailUids.forEach((uid) => pendingEmailLookups.add(uid));
      let lookupSucceeded = false;
      lookupAccountEmails(missingEmailUids)
        .then((emails) => {
          if (!isActive) return;
          emails.forEach(({ uid, email }) => {
            if (email?.trim()) authEmails.set(uid, email.trim());
          });
          missingEmailUids.forEach((uid) => attemptedEmailLookups.add(uid));
          lookupSucceeded = true;
          setEmailLookupError(null);
        })
        .catch((error: unknown) => {
          console.error("Error retrieving account emails from Firebase Authentication:", error);
          if (isActive) {
            setEmailLookupError(
              error instanceof Error
                ? error.message
                : "Account emails could not be fetched. Check admin access and Cloud Functions deployment."
            );
          }
        })
        .finally(() => {
          missingEmailUids.forEach((uid) => pendingEmailLookups.delete(uid));
          if (lookupSucceeded && isActive) updateCombinedList();
        });
    };

    // Listener 1: Regular users ("users" collection)
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        customerAccounts = snapshot.docs.map((d) => {
          const data = d.data();
          const roleStr = String(data.role ?? data.userRole ?? data.type ?? "customer").toLowerCase();

          return {
            id: d.id,
            name: String(
              data.name ?? data.fullName ?? data.displayName ?? data.username ?? data.userName ?? "Customer User"
            ),
            collectionName: "users",
            createdAt: getRecordCreatedAt(data),
            email: firstNonEmptyString(
              data.email,
              data.eMail,
              data.userEmail,
              data.user_email,
              data.emailAddress,
              data.email_address,
              data.contactEmail,
              data.contact_email,
              data.mail
            ),
            phoneNumber: firstNonEmptyValue(
              data.phoneNumber,
              data.phone_number,
              data.phone,
              data.mobileNumber,
              data.mobile_number,
              data.mobile,
              data.contactNumber,
              data.contact_number,
              data.telephone
            ),
            role: (roleStr === "vendor" || roleStr === "admin") ? (roleStr as 'vendor' | 'admin') : "customer",
            isAccountDisabled: Boolean(data.isAccountDisabled),
          };
        });
        updateCombinedList();
      },
      (err) => console.warn("Error loading users collection:", err.message)
    );

    // Listener 2: Vendors ("vendors" collection)
    const unsubVendors = onSnapshot(
      collection(db, "vendors"),
      (snapshot) => {
        vendorAccounts = snapshot.docs.map((d) => {
          const data = d.data();
          const roleStr = String(data.role ?? data.userRole ?? "vendor").toLowerCase();

          return {
            id: d.id,
            name: String(
              data.name ?? data.stallName ?? data.fullName ?? data.ownerName ?? "Vendor Account"
            ),
            collectionName: "vendors",
            createdAt: getRecordCreatedAt(data),
            email: firstNonEmptyString(
              data.email,
              data.eMail,
              data.emailAddress,
              data.email_address,
              data.contactEmail,
              data.contact_email,
              data.vendorEmail,
              data.vendor_email,
              data.ownerEmail,
              data.owner_email,
              data.userEmail,
              data.user_email,
              data.contact
            ),
            phoneNumber: firstNonEmptyValue(
              data.phoneNumber,
              data.phone_number,
              data.phone,
              data.mobileNumber,
              data.mobile_number,
              data.mobile,
              data.contactNumber,
              data.contact_number,
              data.telephone,
              data.contact
            ),
            role: (roleStr === "customer" || roleStr === "admin") ? (roleStr as 'customer' | 'admin') : "vendor",
            isAccountDisabled: Boolean(data.isAccountDisabled),
          };
        });
        updateCombinedList();
      },
      (err) => console.warn("Error loading vendors collection:", err.message)
    );

    return () => {
      isActive = false;
      unsubUsers();
      unsubVendors();
    };
  }, [previewMode]);

  useEffect(() => {
    if (previewMode || screen !== "analytics") return;

    const idsToLookUp = vendorsList
      .filter((vendor) => {
        const id = vendor.id ?? vendor.vendorId;
        if (!id || vendor.createdAt || authCreatedAtByUid[id] || attemptedAnalyticsDateLookups.current.has(id)) {
          return false;
        }
        return !usersList.some(
          (user) => user.id === id && user.role === "vendor" && user.createdAt
        );
      })
      .map((vendor) => vendor.id ?? vendor.vendorId)
      .filter((id): id is string => Boolean(id));

    if (!idsToLookUp.length) return;
    idsToLookUp.forEach((id) => attemptedAnalyticsDateLookups.current.add(id));
    setAnalyticsDateLookupError(null);
    let isActive = true;

    const loadRegistrationDates = async () => {
      try {
        const resolvedDates: Record<string, Date> = {};
        for (let index = 0; index < idsToLookUp.length; index += 100) {
          const dates = await lookupAccountCreationDates(idsToLookUp.slice(index, index + 100));
          dates.forEach((date, uid) => {
            resolvedDates[uid] = date;
          });
        }
        if (isActive) setAuthCreatedAtByUid((current) => ({ ...current, ...resolvedDates }));
      } catch (error) {
        console.error("Unable to load vendor registration dates for analytics:", error);
        if (isActive) {
          setAnalyticsDateLookupError(
            error instanceof Error ? error.message : "Vendor registration dates could not be loaded."
          );
        }
      }
    };

    void loadRegistrationDates();
    return () => {
      isActive = false;
    };
  }, [authCreatedAtByUid, previewMode, screen, usersList, vendorsList]);

  const navigate = (s: Screen, tab?: NavTab) => {
    setScreen(s);
    if (tab) setActiveTab(tab);
  };

  const handleTabPress = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === "dashboard") setScreen("dashboard");
    if (tab === "analytics") setScreen("analytics");
    if (tab === "map") setScreen("map");
    if (tab === "activity-log") setScreen("activity-log");
    if (tab === "booking-history") setScreen("booking-history");
    if (tab === "vendors") setScreen("vendors");
    if (tab === "users") setScreen("users");
  };

  const recordActivity = async (event: ActivityEvent) => {
    try {
      await recordAdminActivity(event);
      setActivityNotice(null);
    } catch (error) {
      console.error("The admin change succeeded, but its activity could not be recorded:", error);
      setActivityNotice("The change was saved, but its activity log entry could not be recorded. Check Cloud Functions and try again after resolving the issue.");
    }
  };

  const handleVendorDetail = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    navigate("vendor-detail", "vendors");
  };

  // Map Pin Click Navigation
  const handleVendorClickFromMap = (vendorId: string) => {
    const vendorToOpen = vendorsList.find((v) => (v.id ?? v.vendorId) === vendorId);
    if (vendorToOpen) {
      setSelectedVendor(vendorToOpen);
      navigate("vendor-detail", "vendors");
    }
  };

  const handleAdminAction = (action: AdminAction) => {
    setPendingAction(action);
    navigate("action-confirm");
  };

  // Edit Listing Handler
  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;
    const vendorId = editingVendor.id ?? editingVendor.vendorId;
    if (!vendorId) return;

    await updateDoc(doc(db, "vendors", vendorId), {
      name: editingVendor.name || editingVendor.stallName || "Vendor",
      stallName: editingVendor.stallName || editingVendor.name || "Vendor",
      category: editingVendor.category || "General",
      openingHours: editingVendor.openingHours || editingVendor.hours || "",
      hours: editingVendor.hours || editingVendor.openingHours || "",
      description: editingVendor.description || "",
    });
    setEditingVendor(null);
    await recordActivity({
      action: "vendor.updated",
      entityType: "vendor",
      entityId: vendorId,
      entityName: editingVendor.stallName || editingVendor.name || "Vendor",
      summary: "Updated vendor listing details.",
    });
  };

  const handleDeleteListing = async (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this listing?")) {
      const vendor = vendorsList.find((item) => (item.id ?? item.vendorId) === id);
      await deleteDoc(doc(db, "vendors", id));
      setVendorsList((currentVendors) =>
        currentVendors.filter((item) => (item.id ?? item.vendorId) !== id)
      );
      await recordActivity({
        action: "vendor.deleted",
        entityType: "vendor",
        entityId: id,
        entityName: vendor?.stallName || vendor?.name || "Vendor",
        summary: "Deleted vendor listing.",
      });
      const selectedId = selectedVendor?.id ?? selectedVendor?.vendorId;
      if (selectedId === id) setScreen("vendors");
    }
  };

  // Update Firebase Authentication login access and mirror the status on the profile.
  const handleToggleDisableUser = async (id: string, role?: string, currentStatus?: boolean) => {
    if (previewMode || activeUserActionId) return;
    const actionName = currentStatus ? "re-enable" : "disable";
    if (!window.confirm(`Are you sure you want to ${actionName} Firebase login access for this account?`)) return;

    const account = usersList.find((user) => user.id === id);
    const collectionName = account?.collectionName ?? (role === "vendor" ? "vendors" : "users");
    setActiveUserActionId(id);
    setUserActionError(null);
    try {
      await performUserManagementAction(currentStatus ? "enable" : "disable", collectionName, id);
      await recordActivity({
        action: currentStatus ? "account.enabled" : "account.disabled",
        entityType: role === "vendor" ? "vendor" : "user",
        entityId: id,
        entityName: account?.name || "Account",
        summary: `${currentStatus ? "Re-enabled" : "Disabled"} ${role ?? "user"} account access.`,
      });
    } catch (error) {
      console.error("Unable to change Firebase login access:", error);
      setUserActionError(error instanceof Error ? error.message : "Could not change this account's login access.");
    } finally {
      setActiveUserActionId(null);
    }
  };

  // Delete the selected profile and its matching Firebase Authentication account.
  const handleDeleteUser = async (id: string, role?: string) => {
    if (previewMode || activeUserActionId) return;
    if (!window.confirm("Permanently delete this account from Firebase Authentication and its selected Firestore profile? This cannot be undone.")) return;

    const account = usersList.find((user) => user.id === id);
    const collectionName = account?.collectionName ?? (role === "vendor" ? "vendors" : "users");
    setActiveUserActionId(id);
    setUserActionError(null);
    try {
      await performUserManagementAction("delete", collectionName, id);
      setUsersList((currentUsers) => currentUsers.filter((user) => user.id !== id));
      await recordActivity({
        action: "account.deleted",
        entityType: role === "vendor" ? "vendor" : "user",
        entityId: id,
        entityName: account?.name || "Account",
        summary: `Deleted ${role ?? "user"} Firebase Authentication account and Firestore profile.`,
      });
    } catch (error) {
      console.error("Unable to delete Firebase account:", error);
      setUserActionError(error instanceof Error ? error.message : "Could not delete this account.");
    } finally {
      setActiveUserActionId(null);
    }
  };

  // Search/Filter Processing for Vendors
  const categories = ["All", ...Array.from(new Set(vendorsList.map((v) => v.category || "General")))];
  const filteredVendors = vendorsList.filter((v) => {
    const matchesSearch = (v.stallName || v.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (v.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "All" || v.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).map((vendor) => {
    const vendorAccount = usersList.find(
      (user) => user.id === (vendor.id ?? vendor.vendorId) && user.role === "vendor"
    );
    return {
      ...vendor,
      phoneNumber: vendor.phoneNumber || vendorAccount?.phoneNumber || "",
    };
  });

  // User Filter & Search Processing
  const filteredUsers = usersList.filter((u) => {
    const matchesRole = userTypeFilter === "all"
      ? true
      : u.role === (
        userTypeFilter === "customers"
          ? "customer"
          : userTypeFilter === "vendors"
            ? "vendor"
            : "admin"
      );
    const matchesSearch = u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });
  
  const customerCount = usersList.filter(u => u.role === "customer").length;
  const vendorCount = usersList.filter(u => u.role === "vendor").length;
  const adminCount = usersList.filter(u => u.role === "admin").length;
  const vendorAccountDates = new Map(
    usersList
      .filter((user) => user.role === "vendor" && user.createdAt)
      .map((user) => [user.id, user.createdAt as Date])
  );
  const chartVendors: DashboardVendor[] = vendorsList.map((vendor) => ({
    id: vendor.id ?? vendor.vendorId ?? "",
    name: vendor.stallName ?? vendor.name ?? "",
    category: vendor.category ?? "",
    openingHours: vendor.openingHours ?? vendor.hours ?? "",
    isOpen: vendor.isOpen === true,
    isAccountDisabled: vendor.isAccountDisabled === true,
    createdAt:
      vendor.createdAt ??
      vendorAccountDates.get(vendor.id ?? vendor.vendorId ?? "") ??
      authCreatedAtByUid[vendor.id ?? vendor.vendorId ?? ""] ??
      null,
  }));

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":
        return (
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <AdminDashboard
              onMonitorVendors={() => navigate("vendors", "vendors")}
              onManageUsers={() => navigate("users", "users")}
              previewMode={previewMode}
            />
            <LiveVendorMap onVendorSelect={handleVendorClickFromMap} previewMode={previewMode} />
          </div>
        );

      case "analytics":
        return (
          <AnalyticsPage
            vendors={chartVendors}
            registeredUsers={usersList.length}
            disabledUserCount={usersList.filter((user) => user.isAccountDisabled).length}
            registrationDateError={analyticsDateLookupError}
            onManageVendors={() => navigate("vendors", "vendors")}
            onManageUsers={() => navigate("users", "users")}
          />
        );

      case "map":
        return (
          <div className="h-full min-h-[520px]">
            <LiveVendorMap onVendorSelect={handleVendorClickFromMap} previewMode={previewMode} fullSize />
          </div>
        );

      case "activity-log":
        return <ActivityLogPage previewMode={previewMode} />;

      case "booking-history":
        return <BookingHistoryPage previewMode={previewMode} />;

      case "vendors":
        return (
          <div style={{ padding: "24px" }}>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#fff", border: "1px solid #EDD9C6", borderRadius: "8px", padding: "0 12px" }}>
                <Search size={16} color="#C7A98A" />
                <input
                  type="text"
                  placeholder="Search vendor name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: "none", outline: "none", width: "100%", padding: "10px", fontSize: "14px" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #EDD9C6", borderRadius: "8px", padding: "0 12px" }}>
                <Filter size={16} color="#C7A98A" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", padding: "10px 0", fontSize: "14px", color: "#2D1A0E" }}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <MonitorVendors
              onBack={() => navigate("dashboard", "dashboard")}
              onVendorDetail={handleVendorDetail}
              vendors={filteredVendors}
              onEditListing={(v: Vendor) => setEditingVendor(v)}
              onDeleteListing={handleDeleteListing}
              previewMode={previewMode}
            />
          </div>
        );

      case "users":
        return (
          <div style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "20px", color: "#2D1A0E", fontWeight: "bold" }}>User Management</h2>
              <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #EDD9C6", borderRadius: "8px", padding: "0 12px", width: "260px" }}>
                <Search size={16} color="#C7A98A" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  style={{ border: "none", outline: "none", width: "100%", padding: "8px", fontSize: "13px" }}
                />
              </div>
            </div>
            
            {/* User Type Tabs */}
            <div style={{ display: "flex", gap: "0", marginBottom: "20px", borderBottom: "2px solid #EDD9C6" }}>
              <button
                onClick={() => setUserTypeFilter("all")}
                style={{
                  padding: "12px 20px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: userTypeFilter === "all" ? "#F05A1A" : "#7A5C2E",
                  borderBottom: userTypeFilter === "all" ? "3px solid #F05A1A" : "none",
                  marginBottom: "-2px"
                }}
              >
                All Users ({usersList.length})
              </button>
              <button
                onClick={() => setUserTypeFilter("customers")}
                style={{
                  padding: "12px 20px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: userTypeFilter === "customers" ? "#F05A1A" : "#7A5C2E",
                  borderBottom: userTypeFilter === "customers" ? "3px solid #F05A1A" : "none",
                  marginBottom: "-2px"
                }}
              >
                Customers ({customerCount})
              </button>
              <button
                onClick={() => setUserTypeFilter("vendors")}
                style={{
                  padding: "12px 20px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: userTypeFilter === "vendors" ? "#F05A1A" : "#7A5C2E",
                  borderBottom: userTypeFilter === "vendors" ? "3px solid #F05A1A" : "none",
                  marginBottom: "-2px"
                }}
              >
                Vendors ({vendorCount})
              </button>
              <button
                onClick={() => setUserTypeFilter("admins")}
                style={{
                  padding: "12px 20px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: userTypeFilter === "admins" ? "#2563EB" : "#7A5C2E",
                  borderBottom: userTypeFilter === "admins" ? "3px solid #2563EB" : "none",
                  marginBottom: "-2px"
                }}
              >
                Admins ({adminCount})
              </button>
            </div>

            {(emailLookupError || userActionError) && (
              <p role="alert" style={{ margin: "0 0 12px", color: "#B42318", fontSize: "13px" }}>
                {userActionError || emailLookupError}
              </p>
            )}

            <div style={{ background: "#fff", border: "1px solid #EDD9C6", borderRadius: "12px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#FDF0E8", borderBottom: "1px solid #EDD9C6", color: "#7A5C2E", fontSize: "13px" }}>
                    <th style={{ padding: "12px 16px" }}>Name</th>
                    <th style={{ padding: "12px 16px" }}>Email</th>
                    <th style={{ padding: "12px 16px" }}>Phone</th>
                    <th style={{ padding: "12px 16px" }}>Role</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#C7A98A" }}>
                        {userTypeFilter === "all" ? "No users found." : `No ${userTypeFilter} found.`}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid #EDD9C6", fontSize: "14px" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "#2D1A0E" }}>{u.name}</td>
                        <td style={{ padding: "12px 16px", color: "#7A5C2E" }}>{u.email}</td>
                        <td style={{ padding: "12px 16px", color: "#7A5C2E", whiteSpace: "nowrap" }}>
                          {u.phoneNumber ? (
                            <a href={`tel:${u.phoneNumber}`} style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "inherit", textDecoration: "none" }}>
                              <Phone size={14} aria-hidden="true" />
                              {u.phoneNumber}
                            </a>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                            background: u.role === "admin" ? "#E8F1FF" : u.role === "vendor" ? "#FDF0E8" : "#E8F5E9",
                            color: u.role === "admin" ? "#2563EB" : u.role === "vendor" ? "#F05A1A" : "#2E7D32"
                          }}>
                            {(u.role || "customer").toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                            background: u.isAccountDisabled ? "#FFEBEE" : "#E8F5E9",
                            color: u.isAccountDisabled ? "#C62828" : "#2E7D32"
                          }}>
                            {u.isAccountDisabled ? "DISABLED" : "ACTIVE"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button
                              title={u.isAccountDisabled ? "Re-enable Account" : "Disable Login Access"}
                              aria-label={u.isAccountDisabled ? `Re-enable login for ${u.name}` : `Disable login for ${u.name}`}
                              disabled={previewMode || activeUserActionId !== null}
                              onClick={() => handleToggleDisableUser(u.id, u.role, u.isAccountDisabled)}
                              style={{ background: "none", border: "none", cursor: previewMode || activeUserActionId !== null ? "not-allowed" : "pointer", opacity: activeUserActionId === u.id ? 0.5 : 1 }}
                            >
                              {activeUserActionId === u.id ? <span aria-label="Saving account change">…</span> : u.isAccountDisabled ? <UserCheck size={16} color="#2E7D32" /> : <UserX size={16} color="#D97706" />}
                            </button>
                            <button
                              title="Delete Firebase account"
                              aria-label={`Delete ${u.name}`}
                              disabled={previewMode || activeUserActionId !== null}
                              onClick={() => handleDeleteUser(u.id, u.role)}
                              style={{ background: "none", border: "none", cursor: previewMode || activeUserActionId !== null ? "not-allowed" : "pointer", opacity: activeUserActionId === u.id ? 0.5 : 1 }}
                            >
                              <Trash2 size={16} color="#EF4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "vendor-detail":
        if (!selectedVendor) return null;
        return (
          <VendorDetail
            vendor={selectedVendor}
            onBack={() => navigate("vendors", "vendors")}
            onSuspend={() => handleAdminAction("suspend")}
            onReactivate={() => handleAdminAction("reactivate")}
          />
        );

      case "action-confirm":
        if (!selectedVendor) return null;
        return (
          <ActionConfirmation
            action={pendingAction}
            vendor={selectedVendor}
            onCancel={() => navigate("vendor-detail", "vendors")}
            onConfirm={() => navigate("vendors", "vendors")}
          />
        );
    }
  };

  const navItems: { tab: NavTab; label: string; icon: React.ReactNode }[] = [
    { tab: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { tab: "analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
    { tab: "map", label: "Vendor Map", icon: <MapIcon size={18} /> },
    { tab: "activity-log", label: "Activity Log", icon: <History size={18} /> },
    { tab: "booking-history", label: "Booking History", icon: <CalendarDays size={18} /> },
    { tab: "vendors", label: "Vendors", icon: <Store size={18} /> },
    { tab: "users", label: "Users", icon: <Users size={18} /> },
  ];

  const pageTitle: Record<Screen, string> = {
    dashboard: "Admin Dashboard",
    analytics: "Analytics",
    map: "Vendor Map",
    "activity-log": "Activity Log",
    "booking-history": "Booking History",
    vendors: "Monitor Vendors",
    users: "User Management",
    "vendor-detail": "Vendor Detail",
    "action-confirm": "Confirm Action",
  };

  return (
    <div className="flex h-full w-full" style={{ background: "#f8f7f3", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="flex w-[68px] flex-shrink-0 flex-col sm:w-[208px] lg:w-[240px]" style={{ background: "#fff", borderRight: "1px solid #e9e5dd", height: "100%" }}>
        <div className="flex h-16 min-h-16 items-center justify-start gap-[9px] border-b px-[14px]" style={{ borderColor: "#e9e5dd" }}>
          <img
            src="/app_logo.png"
            alt="StallSeeker logo"
            className="h-9 w-9 flex-shrink-0 rounded-xl object-cover"
            style={{ boxShadow: "0 5px 12px rgba(217, 83, 22, 0.22)" }}
          />
          <div className="hidden h-[30px] min-w-0 flex-col justify-center sm:flex">
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#2d241d", lineHeight: "18px" }}>StallSeeker</p>
            <p style={{ margin: 0, fontSize: "10px", color: "#a17b58", fontWeight: 500, lineHeight: "12px" }}>Admin Panel</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 py-4 sm:px-3">
          <p className="hidden sm:block" style={{ fontSize: "10px", fontWeight: 700, color: "#a17b58", letterSpacing: "0.08em", marginBottom: "6px", paddingLeft: "12px" }}>
            MAIN MENU
          </p>
          {navItems.map(({ tab, label, icon }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabPress(tab)}
                className="flex w-full items-center justify-center gap-3 rounded-xl px-2 py-3 text-left transition-all hover:bg-[#faf8f4] active:scale-[0.98] sm:justify-start sm:px-3"
                style={{
                  background: isActive ? "#fff2e9" : "transparent",
                  color: isActive ? "#d95316" : "#75685b",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                }}
                aria-current={isActive ? "page" : undefined}
                title={label}
              >
                <span className="flex-shrink-0" style={{ color: isActive ? "#d95316" : "#a17b58" }}>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t px-2 py-3 sm:px-3" style={{ borderColor: "#e9e5dd" }}>
          <button
            type="button"
            onClick={() => setDarkMode((enabled) => !enabled)}
            aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
            aria-pressed={darkMode}
            title={`Switch to ${darkMode ? "light" : "dark"} mode`}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[#faf8f4] sm:justify-start sm:px-3"
            style={{ border: "none", background: "transparent", color: "#75685b", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span className="hidden sm:inline">{darkMode ? "Light mode" : "Dark mode"}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            title="Sign out"
            className="mt-1 flex w-full items-center justify-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[#faf8f4] sm:justify-start sm:px-3"
            style={{ border: "none", background: "transparent", color: "#75685b", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <header className="flex h-16 flex-shrink-0 items-center justify-between px-4 sm:px-6 lg:px-8" style={{ background: "rgba(255,255,255,0.94)", borderBottom: "1px solid #e9e5dd" }}>
          <div>
            <h1 style={{ fontSize: "17px", fontWeight: 650, color: "#2d241d", letterSpacing: "-0.02em" }}>{pageTitle[screen]}</h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: "#f8f7f3" }}>
          {previewMode && (
            <p role="status" className="mx-4 mt-4 rounded-xl px-4 py-3 text-sm sm:mx-6 lg:mx-8" style={{ color: "#785333", background: "#fbf3e8", border: "1px solid #e9d7b7" }}>
              Local UI preview only. Firebase data, activity logs, and account changes are unavailable.
            </p>
          )}
          {signOutError && (
            <p role="alert" className="mx-4 mt-4 rounded-xl px-4 py-3 text-sm sm:mx-6 lg:mx-8" style={{ color: "#8f3b32", background: "#fff0ed", border: "1px solid #f2d1cb" }}>
              {signOutError}
            </p>
          )}
          {activityNotice && (
            <div
              role="alert"
              className="mx-4 mt-4 flex items-start justify-between gap-4 rounded-xl px-4 py-3 text-sm sm:mx-6 lg:mx-8"
              style={{ color: "#8f3b32", background: "#fff0ed", border: "1px solid #f2d1cb" }}
            >
              <span>{activityNotice}</span>
              <button
                type="button"
                onClick={() => setActivityNotice(null)}
                className="flex-shrink-0 font-semibold"
                style={{ color: "#8f3b32", background: "transparent", border: "none", cursor: "pointer" }}
              >
                Dismiss
              </button>
            </div>
          )}
          {renderScreen()}
        </main>
      </div>

      {/* Edit Listing Modal */}
      {editingVendor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <form onSubmit={handleSaveListing} style={{ background: "#fff", padding: "24px", borderRadius: "12px", width: "400px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", color: "#2D1A0E" }}>Edit Vendor Listing</h3>
            <input
              type="text"
              placeholder="Vendor Name"
              value={editingVendor.stallName}
              onChange={(e) => setEditingVendor({ ...editingVendor, stallName: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #EDD9C6" }}
            />
            <input
              type="text"
              placeholder="Category"
              value={editingVendor.category}
              onChange={(e) => setEditingVendor({ ...editingVendor, category: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #EDD9C6" }}
            />
            <input
              type="text"
              placeholder="Opening Hours"
              value={editingVendor.openingHours || ""}
              onChange={(e) => setEditingVendor({ ...editingVendor, openingHours: e.target.value })}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #EDD9C6" }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button type="button" onClick={() => setEditingVendor(null)} style={{ flex: 1, padding: "8px", border: "1px solid #EDD9C6", background: "#fff", borderRadius: "6px", cursor: "pointer" }}>Cancel</button>
              <button type="submit" style={{ flex: 1, padding: "8px", border: "none", background: "#F05A1A", color: "#fff", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Save Changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

type AuthGateState = "loading" | "signed-out" | "checking-admin" | "admin" | "preview" | "not-admin" | "error";

function AuthenticatedAdminApp() {
  const [authGate, setAuthGate] = useState<AuthGateState>("loading");
  const [authGateError, setAuthGateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let verificationId = 0;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const currentVerification = ++verificationId;
      setAuthGateError(null);

      if (import.meta.env.DEV && window.sessionStorage.getItem("stallseeker-admin-preview") === "true") {
        setAuthGate("preview");
        return;
      }

      if (!user) {
        setAuthGate("signed-out");
        return;
      }

      setAuthGate("checking-admin");
      getDoc(doc(db, "users", user.uid))
        .then((profile) => {
          if (!active || currentVerification !== verificationId) return;
          const data = profile.data();
          const role = String(data?.role ?? data?.userRole ?? data?.type ?? "").toLowerCase();
          setAuthGate(role === "admin" ? "admin" : "not-admin");
        })
        .catch((error: unknown) => {
          console.error("Unable to verify the signed-in account's admin role:", error);
          if (!active || currentVerification !== verificationId) return;
          setAuthGateError("Could not verify admin access. Check Firestore access and the role on your users profile.");
          setAuthGate("error");
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (authGate === "loading" || authGate === "checking-admin") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3" style={{ background: "#f8f7f3", color: "#82766a" }}>
        <img
          src="/app_logo.png"
          alt="StallSeeker logo"
          className="h-12 w-12 rounded-xl object-cover"
          style={{ boxShadow: "0 5px 12px rgba(217, 83, 22, 0.22)" }}
        />
        <p className="text-sm">Checking administrator access…</p>
      </main>
    );
  }

  if (authGate === "signed-out") {
    return (
      <AdminLogin
        onPreviewLogin={import.meta.env.DEV ? () => {
          window.sessionStorage.setItem("stallseeker-admin-preview", "true");
          setAuthGate("preview");
        } : undefined}
      />
    );
  }
  if (authGate === "admin") return <AdminDashboardApp />;
  if (authGate === "preview") {
    return (
      <AdminDashboardApp
        previewMode
        onPreviewSignOut={() => {
          window.sessionStorage.removeItem("stallseeker-admin-preview");
          setAuthGate("signed-out");
        }}
      />
    );
  }

  const handleAccessSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Unable to sign out of the unauthorized admin account:", error);
      setAuthGateError("Unable to sign out. Reload the page and try again.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={{ background: "#f8f7f3" }}>
      <section className="w-full max-w-lg rounded-2xl p-6 sm:p-8" style={{ background: "#fff", border: "1px solid #e9e5dd", boxShadow: "0 12px 36px rgba(45, 26, 14, 0.08)" }}>
        <div className="mb-5 flex items-center gap-3">
          <img
            src="/app_logo.png"
            alt="StallSeeker logo"
            className="h-11 w-11 flex-shrink-0 rounded-xl object-cover"
            style={{ boxShadow: "0 5px 12px rgba(217, 83, 22, 0.22)" }}
          />
          <div>
            <p className="font-semibold" style={{ color: "#2d241d" }}>StallSeeker</p>
            <p className="text-xs" style={{ color: "#a17b58" }}>Admin Panel</p>
          </div>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: "#2d241d" }}>
          {authGate === "not-admin" ? "Administrator access required" : "Could not verify access"}
        </h1>
        <p role={authGateError ? "alert" : undefined} className="mt-2 text-sm" style={{ color: authGateError ? "#8f3b32" : "#82766a" }}>
          {authGateError ?? "This Firebase account does not have the admin role in its Firestore users profile."}
        </p>
        <button
          type="button"
          onClick={() => void handleAccessSignOut()}
          className="mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: "#d95316", border: "none", cursor: "pointer" }}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

export default function App() {
  return <AuthenticatedAdminApp />;
}