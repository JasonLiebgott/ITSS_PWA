<script setup>
import { computed, ref, watch } from 'vue';
import * as XLSX from 'xlsx';
import { printerSteps } from './data/printerSteps';
import {
  loadCamps,
  loadDevices,
  loadLocations,
  saveCamps,
  saveDevices,
  saveLocations,
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

const activeTab = ref('steps');
const completedSteps = ref(new Set());
const camps = ref(loadCamps());
const locations = ref(loadLocations(baseLocations));
const devices = ref(loadDevices());
const editingId = ref(null);
const stickyFields = ref({ camp: '', type: '', location: '' });
const showDeviceForm = ref(false);
const selectedCamp = ref('');
const selectedType = ref('');
const form = ref(emptyForm());
const status = ref('');
const geolocationBusy = ref(false);
const newCamp = ref('');
const newLocation = ref('');

function emptyForm() {
  return {
    name: '',
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
    return campMatches && typeMatches;
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
  devices.value = devices.value.map((device) =>
    device.camp === previousCamp ? { ...device, camp } : device
  );
  if (form.value.camp === previousCamp) form.value.camp = camp;
}

function removeCamp(index) {
  if (camps.value.length === 1) return;
  const camp = camps.value[index];
  camps.value.splice(index, 1);
  devices.value = devices.value.map((device) =>
    device.camp === camp ? { ...device, camp: '' } : device
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
  devices.value = devices.value.map((device) =>
    device.location === previousLocation ? { ...device, location } : device
  );
  if (form.value.location === previousLocation) form.value.location = location;
}

function removeLocation(index) {
  if (locations.value.length === 1) return;
  const location = locations.value[index];
  locations.value.splice(index, 1);
  devices.value = devices.value.map((device) =>
    device.location === location ? { ...device, location: '' } : device
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
}

function onPhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    form.value.photo = reader.result;
  };
  reader.readAsDataURL(file);
}

function useToday() {
  form.value.setupDate = new Date().toISOString().slice(0, 10);
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
}

function deleteDevice(id) {
  devices.value = devices.value.filter((device) => device.id !== id);
  if (editingId.value === id) {
    resetForm();
    showDeviceForm.value = false;
  }
  status.value = 'Device deleted.';
}

function exportDevices() {
  const rows = sortedDevices.value.map((device) => ({
    'Vendor #': device.name,
    Camp: device.camp || '',
    Type: device.type || '',
    'Printer IP': device.ipAddress || '',
    Location: device.location || '',
    'Setup Date': device.setupDate || '',
    Notes: device.notes || '',
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Devices');
  XLSX.writeFile(workbook, 'device-inventory.xlsx');
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

</script>

<template>
  <div class="shell">
    <div class="backdrop backdrop-a"></div>
    <div class="backdrop backdrop-b"></div>

    <main class="app">
      <header class="hero card">
        <div>
          <p class="eyebrow">Incident Technology Support Specialists</p>
        </div>

        <div class="hero-actions">
          <button class="tab" :class="{ active: activeTab === 'steps' }" @click="activeTab = 'steps'">
            Printer Steps
          </button>
          <button class="tab" :class="{ active: activeTab === 'devices' }" @click="activeTab = 'devices'">
            Devices
          </button>
          <button class="tab" :class="{ active: activeTab === 'admin' }" @click="activeTab = 'admin'">
            Admin
          </button>
        </div>
      </header>

      <section v-if="activeTab === 'admin'" class="grid admin-grid">
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

      <section v-if="activeTab === 'steps'" class="grid">
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

      <section v-else class="grid devices-grid">
        <article v-if="showDeviceForm" class="card panel form-panel">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ editingId ? 'Edit device' : 'Create device' }}</p>
            </div>
          </div>

          <div class="form-grid">
            <label>
              Vendor #
              <input v-model="form.name" type="text" placeholder="Vendor number" />
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
              <div class="field-row">
                <input v-model="form.setupDate" type="date" />
                <button class="ghost" type="button" @click="useToday">Today</button>
              </div>
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

        <aside class="card panel list-panel">
          <div class="section-header">
            <div>
              <p class="eyebrow">Inventory</p>
              <h2>Saved devices</h2>
            </div>
            <div class="inline-actions">
              <button class="text-link" type="button" @click="startNewDevice">New device</button>
              <p class="meta">{{ filteredDevices.length }} of {{ sortedDevices.length }}</p>
              <button class="ghost small" type="button" :disabled="!sortedDevices.length" @click="exportDevices">
                Download Excel
              </button>
            </div>
          </div>

          <div class="filter-row">
            <label>
              Camp
              <select v-model="selectedCamp">
                <option value="">All camps</option>
                <option v-for="camp in camps" :key="camp" :value="camp">{{ camp }}</option>
              </select>
            </label>
            <label>
              Type
              <select v-model="selectedType">
                <option value="">All types</option>
                <option v-for="type in deviceTypes" :key="type" :value="type">{{ type }}</option>
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
              <div class="device-top">
                <div>
                  <h3>{{ device.name }}</h3>
                  <p>{{ device.type }} · {{ device.location || 'No location set' }}</p>
                </div>
                <div class="device-actions">
                  <button class="danger small" @click.stop="deleteDevice(device.id)">Delete</button>
                </div>
              </div>

                </article>
              </div>
            </section>
          </div>

          <p v-else class="empty-state">
            {{ sortedDevices.length ? 'No devices match the selected filters.' : 'No devices yet. Select New device to add the first install record.' }}
          </p>
        </aside>
      </section>
    </main>
  </div>
</template>
