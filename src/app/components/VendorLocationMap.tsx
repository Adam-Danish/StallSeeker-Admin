import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { ExternalLink, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { Vendor } from './types';
import { getVendorCoordinates } from '../vendorLocation';
import { Button } from './ui/button';

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export function VendorLocationMap({ vendor }: { vendor: Vendor }) {
  const coordinates = getVendorCoordinates(vendor);
  const name = vendor.stallName || vendor.name || 'Vendor';

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-6" aria-label="Vendor location">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg text-foreground">Stall location</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {coordinates ? `${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}` : 'No saved location for this vendor.'}
          </p>
        </div>
        {coordinates && (
          <Button asChild variant="outline">
            <a href={`https://www.google.com/maps/search/?api=1&query=${coordinates.join(',')}`} target="_blank" rel="noopener noreferrer">
              Open in Google Maps <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        )}
      </div>
      {coordinates ? (
        <div className="relative isolate z-0 overflow-hidden rounded-md border border-border" role="region" aria-label={`Map showing ${name}`}>
          <MapContainer key={coordinates.join(',')} center={coordinates} zoom={16} scrollWheelZoom={false} style={{ height: 320, width: '100%' }}>
            <ResizeMap />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker center={coordinates} radius={10} pathOptions={{ color: '#bd3020', fillColor: '#bd3020', fillOpacity: 0.85, weight: 3 }}>
              <Popup><strong>{name}</strong><br />Saved stall location</Popup>
            </CircleMarker>
          </MapContainer>
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center gap-2 rounded-md bg-muted p-4 text-sm text-muted-foreground">
          <MapPin aria-hidden="true" size={18} /> Location unavailable
        </div>
      )}
    </section>
  );
}
