import { useState, useEffect } from "react";
import { Store, Users, Power, PowerOff, TrendingUp } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";

interface Props {
  onMonitorVendors: () => void;
}

export function AdminDashboard({ onMonitorVendors }: Props) {
  const [vendorCount, setVendorCount] = useState(0);
  const [openStallsCount, setOpenStallsCount] = useState(0);
  const [offlineStallsCount, setOfflineStallsCount] = useState(0);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    // Listen to vendors collection
    const vendorsUnsubscribe = onSnapshot(collection(db, "vendors"), (snapshot) => {
      setVendorCount(snapshot.size);
      
      let open = 0;
      let offline = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.isOpen) {
          open++;
        } else {
          offline++;
        }
      });
      setOpenStallsCount(open);
      setOfflineStallsCount(offline);
    });

    // Listen to users collection
    const usersUnsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUserCount(snapshot.size);
      },
      (error) => {
        console.error("Error fetching users:", error);
        // If it's a permission error, we'll set it to a negative number to indicate an error state in the UI
        if (error.code === 'permission-denied') {
          setUserCount(-1); 
        }
      }
    );

    return () => {
      vendorsUnsubscribe();
      usersUnsubscribe();
    };
  }, []);

  return (
    <div className="p-8">
      {/* Page Title */}
      <div className="mb-8">
        <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#2D1A0E" }}>Good morning, Admin 👋</h2>
        <p style={{ fontSize: "14px", color: "#9B7B5B", marginTop: "4px" }}>Here's an overview of your platform today.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: "Total Vendors", value: vendorCount.toString(), color: "#F05A1A", bg: "#FDF0E8", icon: <Store size={20} color="#F05A1A" /> },
          { label: "Open Stalls", value: openStallsCount.toString(), color: "#27AE60", bg: "#EAF7EE", icon: <Power size={20} color="#27AE60" /> },
          { label: "Offline Stalls", value: offlineStallsCount.toString(), color: "#EB5757", bg: "#FDEADE", icon: <PowerOff size={20} color="#EB5757" /> },
          { 
            label: "Total Users", 
            value: userCount === -1 ? "Blocked" : userCount.toString(), 
            color: userCount === -1 ? "#EB5757" : "#2F80ED", 
            bg: userCount === -1 ? "#FDEADE" : "#EBF3FD", 
            icon: <Users size={20} color={userCount === -1 ? "#EB5757" : "#2F80ED"} /> 
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "#fff", border: "1px solid #EDD9C6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                {card.icon}
              </div>
              <TrendingUp size={14} color="#C7A98A" />
            </div>
            <div>
              <p style={{ fontSize: "32px", fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</p>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#2D1A0E", marginTop: "4px" }}>{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom grid: Quick Actions + Info */}
      <div className="grid grid-cols-3 gap-5">
        {/* Quick Actions */}
        <div
          className="rounded-2xl p-6 col-span-1"
          style={{ background: "#fff", border: "1px solid #EDD9C6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#2D1A0E", marginBottom: "16px" }}>Quick Actions</h3>
          <div className="flex flex-col gap-3">
            <button
              onClick={onMonitorVendors}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl active:opacity-80 transition-all"
              style={{ background: "#F05A1A", border: "none", cursor: "pointer" }}
            >
              <Store size={18} color="#fff" />
              <span style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>Monitor Vendors</span>
            </button>
          </div>
        </div>

        {/* Info */}
        <div
          className="rounded-2xl p-6 col-span-2"
          style={{ background: "#fff", border: "1px solid #EDD9C6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#2D1A0E", marginBottom: "16px" }}>System Status</h3>
          <div
            className="flex items-start gap-4 p-4 rounded-xl"
            style={{ background: "#EAF7EE", border: "1px solid #27AE6020" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "#27AE6020" }}
            >
              <Store size={20} color="#27AE60" />
            </div>
            <div className="flex-1">
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#2D1A0E", marginBottom: "4px" }}>
                All systems operational
              </p>
              <p style={{ fontSize: "13px", color: "#7A5C2E", lineHeight: "1.6" }}>
                The backend is connected successfully to Firebase. Database listeners are active and syncing data in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
