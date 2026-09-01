const DEVICE_STORAGE_KEY = 'printer-support-devices';
const CAMP_STORAGE_KEY = 'printer-support-camps';
const LOCATION_STORAGE_KEY = 'printer-support-locations';
const VENDOR_STORAGE_KEY = 'printer-support-vendors';

export function loadVendors(defaultVendors) {
  try {
    const raw = localStorage.getItem(VENDOR_STORAGE_KEY);
    const vendors = raw ? JSON.parse(raw) : [];
    return Array.isArray(vendors) && vendors.length ? vendors : defaultVendors;
  } catch {
    return defaultVendors;
  }
}

export function saveVendors(vendors) {
  localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(vendors));
}

export function loadCamps() {
  try {
    const raw = localStorage.getItem(CAMP_STORAGE_KEY);
    const camps = raw ? JSON.parse(raw) : [];
    return Array.isArray(camps) ? camps : [];
  } catch {
    return [];
  }
}

export function saveCamps(camps) {
  localStorage.setItem(CAMP_STORAGE_KEY, JSON.stringify(camps));
}

export function loadLocations(defaultLocations) {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    const locations = raw ? JSON.parse(raw) : [];
    return Array.isArray(locations) && locations.length ? locations : defaultLocations;
  } catch {
    return defaultLocations;
  }
}

export function saveLocations(locations) {
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locations));
}

export function loadDevices() {
  try {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDevices(devices) {
  localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(devices));
}
