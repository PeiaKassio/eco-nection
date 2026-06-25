import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js';

const EcoData = window.EcoData;

const MAX_ARTWORKS = 36;
const MAX_PER_CONTINENT = 6;
const THUMBNAIL_TIMEOUT_MS = 8000;
const state = { artworks: [], topicClusters: {}, sceneObjects: [], labels: [], selected: null };

const els = {
  mount: document.getElementById('exhibitionCanvas'),
  mode: document.getElementById('exhibitionMode'),
  countryControl: document.getElementById('countryControl'),
  country: document.getElementById('countrySelect'),
  topicControl: document.getElementById('topicControl'),
  topic: document.getElementById('topicSelect'),
  count: document.getElementById('exhibitionCount'),
  modeLabel: document.getElementById('exhibitionModeLabel'),
  info: document.getElementById('artworkInfo')
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
els.mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfead8);
scene.fog = new THREE.Fog(0xcfead8, 16, 55);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
camera.position.set(0, 8, 18);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 7;
controls.maxDistance = 34;
controls.target.set(0, 2, 0);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickable = [];

function byYearAscending(a, b) {
  const ay = EcoData.parseYear(a.properties?.year);
  const by = EcoData.parseYear(b.properties?.year);
  if (ay === null && by === null) return getTitle(a).localeCompare(getTitle(b));
  if (ay === null) return 1;
  if (by === null) return -1;
  return ay - by || getTitle(a).localeCompare(getTitle(b));
}

function getTitle(artwork) { return artwork.properties?.title || 'Untitled'; }
function hasThumbnail(artwork) { return /^https?:\/\//i.test((artwork.properties?.thumbnail || '').trim()); }
function topicsFor(artwork) { return artwork.properties?.tags?.topic || []; }

function initEnvironment() {
  scene.add(new THREE.HemisphereLight(0xeafff3, 0x516345, 2.3));
  const sun = new THREE.DirectionalLight(0xfff2c9, 2.2);
  sun.position.set(-8, 14, 8);
  sun.castShadow = true;
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: 0x506b47, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  for (let i = 0; i < 18; i += 1) addPlant((Math.random() - 0.5) * 55, (Math.random() - 0.5) * 55);
}

function addPlant(x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x6b4f2a }));
  trunk.position.set(x, 0.45, z);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 7), new THREE.MeshStandardMaterial({ color: 0x244d2c, roughness: 0.8 }));
  crown.position.set(x, 1.45, z);
  scene.add(trunk, crown);
}

function clearExhibition() {
  clickable.length = 0;
  state.sceneObjects.forEach((object) => scene.remove(object));
  state.labels.forEach((label) => label.remove());
  state.sceneObjects = [];
  state.labels = [];
}

function addTracked(object) { state.sceneObjects.push(object); scene.add(object); return object; }

function createPanel(x, z, rotationY, width = 5.4, label = '') {
  const panel = addTracked(new THREE.Mesh(new THREE.BoxGeometry(width, 3.4, 0.18), new THREE.MeshStandardMaterial({ color: 0xd7c9a3, roughness: 0.85 })));
  panel.position.set(x, 1.7, z);
  panel.rotation.y = rotationY;
  panel.castShadow = true;
  panel.receiveShadow = true;
  if (label) createHtmlLabel(label, x, 3.85, z, 'font-weight:700;font-size:1rem;');
  return panel;
}

function createHtmlLabel(text, x, y, z, extraStyle = '') {
  const label = document.createElement('div');
  label.className = 'badge badge-primary shadow';
  label.style.cssText = `position:absolute;pointer-events:none;transform:translate(-50%,-50%);max-width:180px;text-align:center;white-space:normal;${extraStyle}`;
  label.textContent = text;
  els.mount.appendChild(label);
  state.labels.push(label);
  label.userData = { position: new THREE.Vector3(x, y, z) };
  return label;
}

function textureFor(url) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), THUMBNAIL_TIMEOUT_MS);
    loader.load(url, (texture) => { clearTimeout(timer); texture.colorSpace = THREE.SRGBColorSpace; resolve(texture); }, undefined, () => { clearTimeout(timer); resolve(null); });
  });
}

async function addArtwork(artwork, x, z, rotationY) {
  const panel = createPanel(x, z, rotationY);
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  const artPos = new THREE.Vector3(x, 1.95, z).addScaledVector(normal, 0.12);
  const texture = await textureFor(artwork.properties.thumbnail.trim());
  if (!texture) return;
  const frame = addTracked(new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.75, 0.12), new THREE.MeshStandardMaterial({ color: 0x3c2b18, roughness: 0.7 })));
  frame.position.copy(artPos);
  frame.rotation.y = rotationY;
  const image = addTracked(new THREE.Mesh(new THREE.PlaneGeometry(2.05, 1.45), new THREE.MeshBasicMaterial({ map: texture })));
  image.position.copy(artPos).addScaledVector(normal, 0.08);
  image.rotation.y = rotationY;
  image.userData.artwork = artwork;
  clickable.push(image);
  const p = artwork.properties;
  createHtmlLabel(`${p.title || 'Untitled'}\n${p.artist || 'Unknown'}${p.year ? `, ${p.year}` : ''}`, artPos.x, 0.55, artPos.z, 'font-size:.72rem;line-height:1.15;');
}

function layoutLine(artworks, heading) {
  createHtmlLabel(heading, 0, 4.4, -7.5, 'font-size:1.05rem;font-weight:700;');
  artworks.slice(0, MAX_ARTWORKS).forEach((artwork, index) => addArtwork(artwork, (index % 6 - 2.5) * 5.8, -8 + Math.floor(index / 6) * 5.2, 0));
}

function layoutContinents() {
  const groups = state.artworks.reduce((acc, artwork) => {
    const continent = artwork.properties.continent || 'Other';
    if (!acc.has(continent)) acc.set(continent, []);
    acc.get(continent).push(artwork);
    return acc;
  }, new Map());
  const continents = [...groups.keys()].sort();
  continents.forEach((continent, zoneIndex) => {
    const angle = (zoneIndex / Math.max(continents.length, 1)) * Math.PI * 2;
    const radius = 11;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    createHtmlLabel(continent, cx, 4.2, cz, 'font-size:1.05rem;font-weight:700;');
    groups.get(continent).sort(byYearAscending).slice(0, MAX_PER_CONTINENT).forEach((artwork, i) => {
      addArtwork(artwork, cx + (i - 2.5) * 2.8 * Math.cos(angle + Math.PI / 2), cz + (i - 2.5) * 2.8 * Math.sin(angle + Math.PI / 2), -angle + Math.PI / 2);
    });
  });
  els.count.textContent = Math.min(state.artworks.length, continents.length * MAX_PER_CONTINENT);
}

function currentSelection() {
  const mode = els.mode.value;
  if (mode === 'continent') return null;
  if (mode === 'country') return state.artworks.filter((a) => a.properties.country === els.country.value).sort(byYearAscending);
  if (mode === 'topic') return state.artworks.filter((a) => a.properties.clusters.includes(els.topic.value) || topicsFor(a).includes(els.topic.value)).sort(byYearAscending);
  return [...state.artworks].sort(byYearAscending);
}

function renderMode() {
  clearExhibition();
  els.countryControl.classList.toggle('hidden', els.mode.value !== 'country');
  els.topicControl.classList.toggle('hidden', els.mode.value !== 'topic');
  els.modeLabel.textContent = els.mode.selectedOptions[0].textContent;
  if (els.mode.value === 'continent') return layoutContinents();
  const selected = currentSelection();
  els.count.textContent = Math.min(selected.length, MAX_ARTWORKS);
  layoutLine(selected, els.mode.value === 'timeline' ? 'Chronological path' : (els.country.value || els.topic.value));
}

function populateControls() {
  const countries = [...new Set(state.artworks.map((a) => a.properties.country).filter(Boolean))].sort();
  els.country.innerHTML = countries.map((country) => `<option>${country}</option>`).join('');
  const topics = new Set(Object.keys(state.topicClusters));
  state.artworks.forEach((a) => topicsFor(a).forEach((topic) => topics.add(topic)));
  els.topic.innerHTML = [...topics].sort().map((topic) => `<option>${topic}</option>`).join('');
}

function showInfo(artwork) {
  const p = artwork.properties;
  els.info.innerHTML = `<h2 class="text-xl font-semibold">${escapeHtml(p.title || 'Untitled')}</h2><dl>
    <div><dt>Artist</dt><dd>${escapeHtml(p.artist || 'Unknown')}</dd></div>
    <div><dt>Year</dt><dd>${escapeHtml(p.year || 'Unknown')}</dd></div>
    <div><dt>Continent / Country</dt><dd>${escapeHtml(p.continent || 'Other')} / ${escapeHtml(p.country || 'Other')}</dd></div>
    <div><dt>Location</dt><dd>${escapeHtml(p.location || 'Unknown')}</dd></div>
    <div><dt>Topics</dt><dd>${escapeHtml(topicsFor(artwork).join(', ') || 'Uncategorized')}</dd></div>
    <div><dt>Description</dt><dd>${escapeHtml((p.description || 'No description available.').slice(0, 240))}${p.description?.length > 240 ? '…' : ''}</dd></div>
    ${p.url ? `<div><dt>Source</dt><dd><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Open source link</a></dd></div>` : ''}
  </dl>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickable)[0];
  if (hit?.object.userData.artwork) showInfo(hit.object.userData.artwork);
}

function resize() {
  const { clientWidth, clientHeight } = els.mount;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / Math.max(clientHeight, 1);
  camera.updateProjectionMatrix();
}

function updateLabels() {
  const width = els.mount.clientWidth;
  const height = els.mount.clientHeight;
  state.labels.forEach((label) => {
    const projected = label.userData.position.clone().project(camera);
    label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    label.style.display = projected.z > 1 ? 'none' : '';
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
}

async function init() {
  initEnvironment();
  const data = await EcoData.loadSharedData();
  state.topicClusters = data.topicClusters;
  state.artworks = data.artworkData.features
    .map((artwork) => EcoData.enrichArtwork(artwork, data))
    .filter(hasThumbnail);
  populateControls();
  renderMode();
  resize();
  animate();
}

els.mode.addEventListener('change', renderMode);
els.country.addEventListener('change', renderMode);
els.topic.addEventListener('change', renderMode);
renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', resize);

init().catch((error) => {
  els.info.innerHTML = `<h2 class="text-xl font-semibold">Exhibition unavailable</h2><p class="mt-2 text-sm opacity-75">${escapeHtml(error.message)}</p>`;
  console.error(error);
});
