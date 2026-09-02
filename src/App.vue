<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { printerSteps } from './data/printerSteps';
import {
  loadCamps,
  loadDevices,
  loadLocations,
  loadVendors,
  saveCamps,
  saveDevices,
  saveLocations,
  saveVendors,
} from './utils/storage';

const deviceTypes = [
  'Laptop',
  '24" Monitor',
  '32" Monitor',
  'Scanner',
  'Printer',
  'Core Kit',
  'AP Kit',
  'Bridge',
  '8 Port POE',
  '4-Port Wireless Router',
  '16-Port Switch',
  'iPad Mini',
  'Presentation Kit',
  '50" TV',
  'Color MFP',
  '11X17 Color Printer',
  'Sat Phone',
  'Starlink Mini',
  'Starlink Gen3'
];

const baseLocations = [
  'Air Ops',
  'Briefing',
  'Check-In',
  'Comm',
  'Comm, IWI Yurt',
  'Equipment Yurt',
  'FACL',
  'FBAN',
  'Finance',
  'Finance Equipment',
  'Finance Time',
  'Finance Trailer',
  'GIS Trailer 2',
  'GIS/SITL Trailer',
  'Ground Support',
  'Home2Suites',
  'ICP',
  'Inventory',
  'IWI',
  'ITSS',
  'ITSS Trailer',
  'ITSS-Trailer',
  'LTAN',
  'OPS',
  'Operations Yurt',
  'PIO',
  'Plans',
  'Resources',
  'SITL',
  'Supply',
];

const defaultVendors = ['SmartSource', 'IAS', 'OAS', 'Hartford'];

const activeTab = ref('home');
const menuOpen = ref(false);
const completedSteps = ref(new Set());
const camps = ref(loadCamps());
const locations = ref(loadLocations(baseLocations));
const vendors = ref(loadVendors(defaultVendors));
const devices = ref(loadDevices());
const editingId = ref(null);
const stickyFields = ref({ camp: '', type: '', location: '', vendor: defaultVendors[0] });
const showDeviceForm = ref(false);
const selectedCamp = ref('');
const selectedType = ref('');
const selectedChangeScope = ref('all');
const form = ref(emptyForm());
const status = ref('');
const geolocationBusy = ref(false);
const newCamp = ref('');
const newLocation = ref('');
const newVendor = ref('');
const importMode = ref('append');
const updateAvailable = ref(false);
let xlsxModule;

function emptyForm() {
  return {
    name: '',
    vendor: stickyFields.value.vendor,
    camp: stickyFields.value.camp,
    type: stickyFields.value.type,
    ipAddress: '',
    location: stickyFields.value.location,
    latitude: '',
    longitude: '',
    setupDate: new Date().toISOString().slice(0, 10),
    notes: '',
    photo: '',
  };
}

const sortedDevices = computed(() =>
  [...devices.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
);

const filteredDevices = computed(() =>
  sortedDevices.value.filter((device) => {
    const campMatches = !selectedCamp.value || device.camp === selectedCamp.value;
    const typeMatches = !selectedType.value || device.type === selectedType.value;
    const changeMatches = selectedChangeScope.value === 'all'
      || (selectedChangeScope.value === 'since-import' && hasChangedSinceImport(device))
      || (selectedChangeScope.value === 'today' && wasModifiedToday(device));
    return campMatches && typeMatches && changeMatches;
  })
);

const groupedDevices = computed(() =>
  [...camps.value, 'Unassigned']
    .map((camp) => ({
      camp,
      devices: filteredDevices.value.filter((device) => (device.camp || 'Unassigned') === camp),
    }))
    .filter((group) => group.devices.length)
);

const printerTypes = new Set(['Printer', 'Color MFP', '11X17 Color Printer']);
const needsPrinterIp = computed(() => printerTypes.has(form.value.type));

function addCamp() {
  const camp = newCamp.value.trim();
  if (!camp || camps.value.includes(camp)) return;
  camps.value.push(camp);
  newCamp.value = '';
}

function renameCamp(index, value) {
  const camp = value.trim();
  if (!camp || camps.value.some((item, itemIndex) => itemIndex !== index && item === camp)) return;
  const previousCamp = camps.value[index];
  camps.value[index] = camp;
  const updatedAt = new Date().toISOString();
  devices.value = devices.value.map((device) =>
    device.camp === previousCamp ? { ...device, camp, updatedAt } : device
  );
  if (form.value.camp === previousCamp) form.value.camp = camp;
}

function removeCamp(index) {
  if (camps.value.length === 1) return;
  const camp = camps.value[index];
  camps.value.splice(index, 1);
  const updatedAt = new Date().toISOString();
  devices.value = devices.value.map((device) =>
    device.camp === camp ? { ...device, camp: '', updatedAt } : device
  );
  if (form.value.camp === camp) form.value.camp = '';
}

function addLocation() {
  const location = newLocation.value.trim();
  if (!location || locations.value.includes(location)) return;
  locations.value.push(location);
  newLocation.value = '';
}

function renameLocation(index, value) {
  const location = value.trim();
  if (!location || locations.value.some((item, itemIndex) => itemIndex !== index && item === location)) return;
  const previousLocation = locations.value[index];
  locations.value[index] = location;
  const updatedAt = new Date().toISOString();
  devices.value = devices.value.map((device) =>
    device.location === previousLocation ? { ...device, location, updatedAt } : device
  );
  if (form.value.location === previousLocation) form.value.location = location;
}

function removeLocation(index) {
  if (locations.value.length === 1) return;
  const location = locations.value[index];
  locations.value.splice(index, 1);
  const updatedAt = new Date().toISOString();
  devices.value = devices.value.map((device) =>
    device.location === location ? { ...device, location: '', updatedAt } : device
  );
  if (form.value.location === location) form.value.location = '';
}

function toggleStep(index) {
  const next = new Set(completedSteps.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  completedSteps.value = next;
}

function resetForm() {
  editingId.value = null;
  form.value = emptyForm();
}

function startNewDevice() {
  editingId.value = null;
  form.value = emptyForm();
  showDeviceForm.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addVendor() {
  const vendor = newVendor.value.trim();
  if (!vendor || vendors.value.includes(vendor)) return;
  vendors.value.push(vendor);
  newVendor.value = '';
}

function renameVendor(index, value) {
  const vendor = value.trim();
  if (!vendor || vendors.value.some((item, itemIndex) => itemIndex !== index && item === vendor)) return;
  const previousVendor = vendors.value[index];
  vendors.value[index] = vendor;
  const updatedAt = new Date().toISOString();
  devices.value = devices.value.map((device) =>
    device.vendor === previousVendor ? { ...device, vendor, updatedAt } : device
  );
  if (form.value.vendor === previousVendor) form.value.vendor = vendor;
}

function removeVendor(index) {
  if (vendors.value.length === 1) return;
  const vendor = vendors.value[index];
  vendors.value.splice(index, 1);
  const updatedAt = new Date().toISOString();
  devices.value = devices.value.map((device) =>
    device.vendor === vendor ? { ...device, vendor: '', updatedAt } : device
  );
  if (form.value.vendor === vendor) form.value.vendor = '';
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getImportValue(row, names) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function formatImportDate(value, xlsx) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const date = xlsx.SSF.parse_date_code(value);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function importTypeForSheet(sheetName) {
  const types = {
    'sat phones': 'Sat Phone',
    'starlink minis': 'Starlink Mini',
    'starlink gen3': 'Starlink Gen3',
  };
  return types[sheetName.toLowerCase()] || '';
}

function importIdentifierForSheet(sheetName, row) {
  const key = sheetName.toLowerCase().replace(/\s+/g, '');
  const identifiers = {
    'smartsource': ['Vendor #'],
    'satphones': ['Device ID'],
    'starlinkminis': ['Device ID'],
    'starlinkgen3': ['Device ID'],
    'accesspoints': ['ID#'],
    'team3cache': ['ID#'],
    'team3cached': ['ID#'],
  };
  return getImportValue(row, identifiers[key] || ['Vendor #', 'Device ID', 'ID#', 'Name Assigned', 'Name']);
}

function canonicalVendor(value) {
  const vendor = String(value || '').trim();
  return vendors.value.find((item) => item.toLowerCase() === vendor.toLowerCase()) || vendor;
}

function hasChangedSinceImport(device) {
  return !device.importedAt || device.updatedAt > device.importedAt;
}

function wasModifiedToday(device) {
  return localDateKey(device.updatedAt) === localDateKey(new Date());
}

function localDateKey(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

async function importInventory(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    xlsxModule ||= await import('xlsx');
    const workbook = xlsxModule.read(await file.arrayBuffer(), { cellDates: true });
    const imported = [];

    for (const sheetName of workbook.SheetNames) {
      if (sheetName.trim().toLowerCase() === 'reference only') continue;

      const sheet = workbook.Sheets[sheetName];
      const rows = xlsxModule.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
      const headers = rows.shift()?.map(normalizeHeader) || [];

      for (const values of rows) {
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
        const name = importIdentifierForSheet(sheetName, row);
        if (!String(name).trim()) continue;

        const type = getImportValue(row, ['Type']) || importTypeForSheet(sheetName);
        const vendor = canonicalVendor(sheetName.trim().toLowerCase() === 'smart source'
          ? 'SmartSource'
          : getImportValue(row, ['Vendor']));
        const camp = String(getImportValue(row, ['Camp']) || '').trim();
        const location = String(getImportValue(row, ['Location in Camp', 'Location']) || '').trim();
        const setupDate = formatImportDate(getImportValue(row, ['Inventory Date', 'Iventory Date']), xlsxModule);
        const notes = String(getImportValue(row, ['Notes']) || '').trim();
        const now = new Date().toISOString();

        imported.push({
          id: crypto.randomUUID(),
          name: String(name).trim(),
          vendor,
          camp,
          type: String(type).trim(),
          ipAddress: '',
          location,
          latitude: '',
          longitude: '',
          setupDate,
          notes,
          photo: '',
          createdAt: now,
          updatedAt: now,
          importedAt: now,
        });
      }
    }

    if (!imported.length) {
      status.value = 'No compatible records found in that workbook.';
      return;
    }

    devices.value = importMode.value === 'replace' ? imported : [...imported, ...devices.value];
    camps.value = [...new Set([...camps.value, ...imported.map((device) => device.camp).filter(Boolean)])];
    locations.value = [...new Set([...locations.value, ...imported.map((device) => device.location).filter(Boolean)])];
    vendors.value = [...new Set([...vendors.value, ...imported.map((device) => device.vendor).filter(Boolean)])];
    status.value = `${imported.length} record${imported.length === 1 ? '' : 's'} ${importMode.value === 'replace' ? 'imported' : 'appended'}.`;
  } catch {
    status.value = 'Could not read that Excel file.';
  } finally {
    event.target.value = '';
  }
}

const pageTitle = computed(() => ({
  steps: 'Printer',
  devices: 'Inventory',
  admin: 'Admin',
}[activeTab.value] || 'Field support'));

function navigateTo(tab) {
  activeTab.value = tab;
  menuOpen.value = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyUpdate() {
  window.dispatchEvent(new Event('pwa-apply-update'));
}

function announceUpdate() {
  updateAvailable.value = true;
}

onMounted(() => {
  window.addEventListener('pwa-update-available', announceUpdate);
});

onBeforeUnmount(() => {
  window.removeEventListener('pwa-update-available', announceUpdate);
});

function onPhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    form.value.photo = reader.result;
  };
  reader.readAsDataURL(file);
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    status.value = 'Geolocation is not available on this device.';
    return;
  }

  geolocationBusy.value = true;
  status.value = '';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      form.value.latitude = position.coords.latitude.toFixed(6);
      form.value.longitude = position.coords.longitude.toFixed(6);
      geolocationBusy.value = false;
      status.value = 'Location filled from the device.';
    },
    () => {
      geolocationBusy.value = false;
      status.value = 'Could not read location. Check browser permissions.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function saveDevice() {
  if (!form.value.name.trim()) {
    status.value = 'Vendor # is required.';
    activeTab.value = 'devices';
    return;
  }

  const payload = {
    ...form.value,
    ipAddress: needsPrinterIp.value ? form.value.ipAddress.trim() : '',
    latitude: form.value.latitude ? String(form.value.latitude).trim() : '',
    longitude: form.value.longitude ? String(form.value.longitude).trim() : '',
  };

  stickyFields.value = {
    camp: form.value.camp,
    type: form.value.type,
    location: form.value.location,
    vendor: form.value.vendor,
  };

  if (editingId.value) {
    devices.value = devices.value.map((device) =>
      device.id === editingId.value
        ? { ...device, ...payload, updatedAt: new Date().toISOString() }
        : device
    );
    status.value = 'Device updated.';
  } else {
    devices.value = [
      {
        id: crypto.randomUUID(),
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...devices.value,
    ];
    status.value = 'Device created.';
  }

  resetForm();
  showDeviceForm.value = false;
  activeTab.value = 'devices';
}

function editDevice(device) {
  editingId.value = device.id;
  form.value = {
    ...emptyForm(),
    ...device,
    camp: device.camp || '',
    location: device.location || '',
  };
  showDeviceForm.value = true;
  activeTab.value = 'devices';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteDevice(id) {
  const device = devices.value.find((item) => item.id === id);
  const label = device?.name ? `Vendor # ${device.name}` : 'this device';
  if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
  devices.value = devices.value.filter((device) => device.id !== id);
  if (editingId.value === id) {
    resetForm();
    showDeviceForm.value = false;
  }
  status.value = 'Device deleted.';
}

async function exportDevices() {
  xlsxModule ||= await import('xlsx');
  const rows = filteredDevices.value.map((device) => ({
    'Vendor #': device.name,
    Vendor: device.vendor || '',
    Camp: device.camp || '',
    Type: device.type || '',
    'Printer IP': device.ipAddress || '',
    Location: device.location || '',
    'Setup Date': device.setupDate || '',
    Notes: device.notes || '',
  }));
  const worksheet = xlsxModule.utils.json_to_sheet(rows);
  const workbook = xlsxModule.utils.book_new();
  xlsxModule.utils.book_append_sheet(workbook, worksheet, 'Devices');
  const suffix = selectedChangeScope.value === 'since-import'
    ? 'changed-since-import'
    : selectedChangeScope.value === 'today'
      ? 'changed-today'
      : 'all';
  xlsxModule.writeFile(workbook, `device-inventory-${suffix}.xlsx`);
}

watch(
  devices,
  (value) => {
    saveDevices(value);
  },
  { deep: true }
);

watch(
  camps,
  (value) => {
    saveCamps(value);
  },
  { deep: true }
);

watch(
  locations,
  (value) => {
    saveLocations(value);
  },
  { deep: true }
);

watch(
  vendors,
  (value) => {
    saveVendors(value);
  },
  { deep: true }
);

</script>

<template>
  <div class="shell">
    <div class="backdrop backdrop-a"></div>
    <div class="backdrop backdrop-b"></div>

    <div v-if="updateAvailable" class="update-banner" role="status">
      <span>New version available.</span>
      <div class="update-actions">
        <button class="primary small" type="button" @click="applyUpdate">Update</button>
        <button class="ghost small" type="button" @click="updateAvailable = false">Later</button>
      </div>
    </div>

    <main class="app">
      <header class="hero card" :class="{ 'home-hero': activeTab === 'home' }">
        <div>
          <p class="eyebrow">Incident Technology Support Specialists</p>
          <h1>{{ activeTab === 'home' ? 'Field support' : pageTitle }}</h1>
        </div>

        <div class="menu-wrap">
          <button
            class="menu-button"
            type="button"
            aria-label="Open navigation menu"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <nav v-if="menuOpen" class="menu" aria-label="Primary navigation">
            <button :class="{ active: activeTab === 'home' }" type="button" @click="navigateTo('home')">
              Home
            </button>
            <button :class="{ active: activeTab === 'devices' }" type="button" @click="navigateTo('devices')">
              Inventory
            </button>
            <button :class="{ active: activeTab === 'admin' }" type="button" @click="navigateTo('admin')">
              Admin
            </button>
          </nav>
        </div>
      </header>

      <section v-if="activeTab === 'home'" class="home-actions" aria-label="Main options">
        <button class="home-option" type="button" @click="navigateTo('devices')">
          <span class="home-option-label">Inventory</span>
          <span class="home-option-detail">View and edit equipment records</span>
        </button>
        <button class="home-option" type="button" @click="navigateTo('steps')">
          <span class="home-option-label">Printer</span>
          <span class="home-option-detail">Follow printer setup steps</span>
        </button>
        <button class="home-option" type="button" @click="navigateTo('admin')">
          <span class="home-option-label">Admin</span>
          <span class="home-option-detail">Manage camps and locations</span>
        </button>
      </section>

      <section v-else-if="activeTab === 'admin'" class="grid admin-grid">
        <article class="card panel import-panel">
          <div class="section-header">
            <div>
              <p class="eyebrow">Data</p>
              <h2>Import Excel inventory</h2>
            </div>
            <p class="meta">Supported fields are imported; unrelated columns are ignored.</p>
          </div>

          <div class="import-actions">
            <label>
              Import behavior
              <select v-model="importMode">
                <option value="append">Append to current records</option>
                <option value="replace">Replace current records</option>
              </select>
            </label>
            <label class="file-button">
              Choose Excel file
              <input type="file" accept=".xlsx,.xls" @change="importInventory" />
            </label>
          </div>
          <p class="status">{{ status }}</p>
        </article>

        <article class="card panel">
          <div class="section-header">
            <div>
              <h2>Vendors</h2>
            </div>
            <p class="meta">Edit the vendor list used by inventory.</p>
          </div>
          <div class="camp-manager">
            <div class="camp-list">
              <div v-for="(vendor, index) in vendors" :key="vendor" class="camp-item">
                <input :value="vendor" type="text" aria-label="Vendor name" @change="renameVendor(index, $event.target.value)" />
                <button class="danger small" type="button" :disabled="vendors.length === 1" @click="removeVendor(index)">Remove</button>
              </div>
            </div>
            <div class="camp-add">
              <input v-model="newVendor" type="text" placeholder="New vendor" @keyup.enter="addVendor" />
              <button class="ghost small" type="button" @click="addVendor">Add vendor</button>
            </div>
          </div>
        </article>

        <article class="card panel">
          <div class="section-header">
            <div>
              <h2>Camps</h2>
            </div>
            <p class="meta">Edit the camp list used by inventory.</p>
          </div>
          <div class="camp-manager">
            <div class="camp-list">
              <div v-for="(camp, index) in camps" :key="camp" class="camp-item">
                <input :value="camp" type="text" aria-label="Camp name" @change="renameCamp(index, $event.target.value)" />
                <button class="danger small" type="button" :disabled="camps.length === 1" @click="removeCamp(index)">Remove</button>
              </div>
            </div>
            <div class="camp-add">
              <input v-model="newCamp" type="text" placeholder="New camp" @keyup.enter="addCamp" />
              <button class="ghost small" type="button" @click="addCamp">Add camp</button>
            </div>
          </div>
        </article>

        <article class="card panel">
          <div class="section-header">
            <div>
              <h2>Locations</h2>
            </div>
            <p class="meta">Edit the location list used by inventory.</p>
          </div>
          <div class="camp-manager">
            <div class="camp-list">
              <div v-for="(location, index) in locations" :key="location" class="camp-item">
                <input :value="location" type="text" aria-label="Location name" @change="renameLocation(index, $event.target.value)" />
                <button class="danger small" type="button" :disabled="locations.length === 1" @click="removeLocation(index)">Remove</button>
              </div>
            </div>
            <div class="camp-add">
              <input v-model="newLocation" type="text" placeholder="New location" @keyup.enter="addLocation" />
              <button class="ghost small" type="button" @click="addLocation">Add location</button>
            </div>
          </div>
        </article>
      </section>

      <section v-else-if="activeTab === 'steps'" class="grid">
        <article class="card panel">
          <div class="section-header">
            <div>
              <h2>Printer steps</h2>
            </div>
          </div>

          <ol class="steps">
            <li v-for="(step, index) in printerSteps" :key="step.title" class="step">
              <button class="step-toggle" @click="toggleStep(index)">
                <span class="step-index">{{ index + 1 }}</span>
                <span class="step-copy">
                  <strong>{{ step.title }}</strong>
                  <small>{{ step.detail }}</small>
                </span>
                <span class="check" :class="{ done: completedSteps.has(index) }">
                  {{ completedSteps.has(index) ? 'Done' : 'Open' }}
                </span>
              </button>
            </li>
          </ol>
        </article>

      </section>

      <section v-else class="grid devices-grid" :class="{ 'editing-layout': showDeviceForm }">
        <article v-if="showDeviceForm" class="card panel form-panel">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ editingId ? 'Edit device' : 'Create device' }}</p>
              <h2 v-if="editingId">Edit record</h2>
            </div>
          </div>

          <div class="form-grid">
            <label>
              Vendor #
              <input v-model="form.name" type="text" placeholder="Vendor number" />
            </label>
            <label>
              Vendor
              <select v-model="form.vendor">
                <option disabled value="">Select vendor</option>
                <option v-if="form.vendor && !vendors.includes(form.vendor)" :value="form.vendor">
                  {{ form.vendor }}
                </option>
                <option v-for="vendor in vendors" :key="vendor" :value="vendor">
                  {{ vendor }}
                </option>
              </select>
            </label>
            <label>
              Camp
              <select v-model="form.camp">
                <option disabled value="">Select camp</option>
                <option v-for="camp in camps" :key="camp" :value="camp">
                  {{ camp }}
                </option>
              </select>
            </label>
            <label>
              Type
              <select v-model="form.type">
                <option disabled value="">Select type</option>
                <option v-if="form.type && !deviceTypes.includes(form.type)" :value="form.type">
                  {{ form.type }}
                </option>
                <option v-for="type in deviceTypes" :key="type" :value="type">
                  {{ type }}
                </option>
              </select>
            </label>
            <label v-if="needsPrinterIp">
              Printer IP
              <input v-model="form.ipAddress" type="text" placeholder="192.168.1.50" />
            </label>
            <label>
              Setup date
              <input v-model="form.setupDate" type="date" />
            </label>
            <label class="full">
              Location
              <select v-model="form.location">
                <option disabled value="">Select location</option>
                <option v-if="form.location && !locations.includes(form.location)" :value="form.location">
                  {{ form.location }}
                </option>
                <option v-for="location in locations" :key="location" :value="location">
                  {{ location }}
                </option>
              </select>
            </label>
            <!--
            <label>
              Latitude
              <input v-model="form.latitude" type="text" placeholder="Latitude" inputmode="decimal" />
            </label>
            <label>
              Longitude
              <input v-model="form.longitude" type="text" placeholder="Longitude" inputmode="decimal" />
            </label>
            -->
          </div>

          <div class="inline-actions">
            <!--
            <button class="ghost" type="button" :disabled="geolocationBusy" @click="useCurrentLocation">
              {{ geolocationBusy ? 'Getting location...' : 'Use current lat/long' }}
            </button>
            -->
            <label class="file-button">
              Add photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                @change="onPhotoChange"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea v-model="form.notes" rows="4" placeholder="Installation notes, driver details, issues found, etc."></textarea>
          </label>

          <div v-if="form.photo" class="photo-preview">
            <img :src="form.photo" alt="Device photo preview" />
          </div>

          <div class="form-actions">
            <button class="primary" type="button" @click="saveDevice">
              {{ editingId ? 'Update device' : 'Create device' }}
            </button>
          </div>

          <p class="status">{{ status }}</p>
        </article>

        <aside v-else class="card panel list-panel">
          <div class="section-header inventory-header">
            <div class="inventory-actions">
              <button class="ghost small" type="button" :disabled="!filteredDevices.length" @click="exportDevices">
                Download {{ filteredDevices.length }}
                {{ selectedChangeScope === 'all' ? 'items' : 'changes' }}
              </button>
            </div>
            <div class="inventory-actions">
              <button class="ghost small add-button" type="button" @click="startNewDevice">
                <span aria-hidden="true">+</span>
                Add New
              </button>
            </div>
          </div>

          <div class="filter-row">
            <label>
              <select v-model="selectedCamp" aria-label="Filter by camp">
                <option value="">All camps</option>
                <option v-for="camp in camps" :key="camp" :value="camp">{{ camp }}</option>
              </select>
            </label>
            <label>
              <select v-model="selectedType" aria-label="Filter by type">
                <option value="">All types</option>
                <option v-for="type in deviceTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </label>
            <label>
              <select v-model="selectedChangeScope" aria-label="Filter by change status">
                <option value="all">All items</option>
                <option value="since-import">Changed since import</option>
                <option value="today">Changed today</option>
              </select>
            </label>
          </div>

          <div v-if="filteredDevices.length" class="device-groups">
            <section v-for="group in groupedDevices" :key="group.camp" class="device-group">
              <h3 class="group-title">{{ group.camp }}</h3>
              <div class="device-list">
                <article
                  v-for="device in group.devices"
                  :key="device.id"
                  class="device-card"
                  role="button"
                  tabindex="0"
                  @click="editDevice(device)"
                  @keydown.enter="editDevice(device)"
                  @keydown.space.prevent="editDevice(device)"
                >
                  <div class="device-line">
                    <div class="device-identity">
                      <h3>{{ device.name }}</h3>
                      <p class="device-vendor">{{ device.vendor || 'No vendor set' }}</p>
                    </div>
                    <p class="device-summary">{{ device.type || 'Uncategorized' }} / {{ device.location || 'No location set' }}</p>
                    <div class="device-actions">
                      <button class="danger small" @click.stop="deleteDevice(device.id)">Delete</button>
                    </div>
                  </div>

                </article>
              </div>
            </section>
          </div>

          <p v-else class="empty-state">
            {{ sortedDevices.length
              ? (selectedChangeScope === 'today' ? 'No devices were modified today.' : selectedChangeScope === 'since-import' ? 'No devices have changed since import.' : 'No devices match the selected filters.')
              : 'No devices yet. Select New device to add the first install record.' }}
          </p>
        </aside>
      </section>
    </main>
  </div>
</template>
