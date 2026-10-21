import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const activeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const inactiveIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface Vendor {
  id: string;
  name: string;
  category: string;
  isOpen: boolean;
  lat: number;
  lng: number;
}

const RecenterMap = ({ markers }: { markers: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [markers, map]);
  return null;
};

export const LiveVendorMap: React.FC<{
  onVendorSelect?: (id: string) => void;
  previewMode?: boolean;
  fullSize?: boolean;
}> = ({
  onVendorSelect,
  previewMode = false,
  fullSize = false,
}) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);

  useEffect(() => {
    if (previewMode) return;

    // 📡 Live Firebase Snapshot Listener
    const unsubscribe = onSnapshot(collection(db, 'vendors'), (snapshot) => {
      let active = 0;
      const validVendors: Vendor[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.isOpen) active++;

        const lat = Number(data.lat ?? data.latitude ?? data.location?.latitude ?? 0);
        const lng = Number(data.lng ?? data.longitude ?? data.location?.longitude ?? 0);

        if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
          validVendors.push({
            id: doc.id,
            name: data.name || data.stallName || 'Vendor Stall',
            category: data.category || 'General',
            isOpen: data.isOpen === true,
            lat,
            lng,
          });
        }
      });

      setActiveCount(active);
      setVendors(validVendors);
    });

    return () => unsubscribe();
  }, [previewMode]);

  const markerPositions: [number, number][] = vendors.map((v) => [v.lat, v.lng]);

  return (
    <div style={{
      background: '#fff',
      borderRadius: fullSize ? '0' : '12px',
      padding: fullSize ? '20px' : '16px',
      border: fullSize ? 'none' : '1px solid #EDD9C6',
      marginBottom: fullSize ? '0' : '24px',
      height: fullSize ? '100%' : undefined,
      display: fullSize ? 'flex' : undefined,
      flexDirection: fullSize ? 'column' : undefined,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#C7A98A', letterSpacing: '0.5px' }}>{previewMode ? 'VENDOR LOCATIONS' : 'LIVE VENDOR LOCATIONS'}</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#2D1A0E' }}>
            {previewMode ? 'Location data is unavailable in local preview mode' : 'Real-time geographic status of active stalls'}
          </p>
        </div>
        {!previewMode && (
          <span style={{ background: '#E8F5E9', color: '#2E7D32', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
            ● {activeCount} Active Stalls
          </span>
        )}
      </div>

      {previewMode ? (
        <div className="flex h-[200px] items-center justify-center rounded-lg text-sm" style={{ background: "#f8f7f3", color: "#82766a" }}>
          Live map disabled in local preview mode.
        </div>
      ) : <div style={{ height: fullSize ? '100%' : '350px', minHeight: fullSize ? '420px' : undefined, flex: fullSize ? 1 : undefined, width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
        <MapContainer center={[2.9369, 101.7914]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markerPositions.length > 0 && <RecenterMap markers={markerPositions} />}
          {vendors.map((vendor) => (
            <Marker
              key={vendor.id}
              position={[vendor.lat, vendor.lng]}
              icon={vendor.isOpen ? activeIcon : inactiveIcon}
              eventHandlers={{
                click: () => onVendorSelect && onVendorSelect(vendor.id),
              }}
            >
              <Popup>
                <strong>{vendor.name}</strong>
                <br />
                Category: {vendor.category}
                <br />
                Status: <span style={{ color: vendor.isOpen ? 'green' : 'red' }}>{vendor.isOpen ? 'Open' : 'Closed'}</span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>}
    </div>
  );
};