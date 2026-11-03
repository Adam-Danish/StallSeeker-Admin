import type { Vendor } from './components/types';

export function getVendorCoordinates(vendor: Vendor): [number, number] | null {
  const latitude = vendor.latitude ?? vendor.lat;
  const longitude = vendor.longitude ?? vendor.lng;
  if (typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
    || (latitude === 0 && longitude === 0)) return null;
  return [latitude, longitude];
}
