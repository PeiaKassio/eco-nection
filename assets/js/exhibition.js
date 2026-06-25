import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js';

const EcoData = window.EcoData;
const MAX_ARTWORKS = 30;
const MAX_PER_CONTINENT = 4;
const MAX_TOPIC_ARTWORKS = 12;
const MAX_TIMELINE_ARTWORKS = 18;
const THUMBNAIL_TIMEOUT_MS = 8000;

const ROOMS = {
  entrance: { center: new THREE.Vector3(0, 1.8, 7.5), camera: new THREE.Vector3(0, 4.2, 17.5), target: new THREE.Vector3(0, 1.9, 2.6) },
  continent: { center: new THREE.Vector3(-13, 1.8, -5.2), camera: new THREE.Vector3(-13, 4.1, 3.6), target: new THREE.Vector3(-13, 2, -7.5), label: 'Continents' },
  topic: { center: new THREE.Vector3(0, 1.8, -5.2), camera: new THREE.Vector3(0, 4.1, 3.6), target: new THREE.Vector3(0, 2, -7.5), label: 'Topics' },
  timeline: { center: new THREE.Vector3(13, 1.8, -5.2), camera: new THREE.Vector3(13, 4.1, 3.6), target: new THREE.Vector3(13, 2, -7.5), label: 'Timeline' }
};

const state = {
  artworks: [],
  topicClusters: {},
  sceneObjects: [],
  labels: [],
  displayed: [],
  selectedIndex: -1,
  cameraGoal: null,
  currentRoom: 'continent'
};

const els = {
  mount: document.getElementById('exhibitionCanvas'),
  mode: document.getElementById('exhibitionMode'),
  topicControl: document.getElementById('topicControl'),
  topic: document.getElementById('topicSelect'),
  enterContinents: document.getElementById('enterContinents'),
  enterTopics: document.getElementById('enterTopics'),
  enterTimeline: document.getElementById('enterTimeline'),
  previous: document.getElementById('previousArtwork'),
  next: document.getElementById('nextArtwork'),
  overview: document.getElementById('overviewGallery'),
  count: document.getElementById('exhibitionCount'),
  modeLabel: document.getElementById('exhibitionModeLabel'),
  info: document.getElementById('artworkInfo')
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
els.mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe6dbc9);
scene.fog = new THREE.Fog(0xe6dbc9, 22, 54);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
camera.position.copy(ROOMS.entrance.camera);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.minPolarAngle = Math.PI * 0.32;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minAzimuthAngle = -Math.PI * 0.22;
controls.maxAzimuthAngle = Math.PI * 0.22;
controls.minDistance = 3.2;
controls.maxDistance = 10;
controls.target.copy(ROOMS.entrance.target);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickable = [];

function getTitle(artwork) { return artwork.properties?.title || 'Untitled'; }
function topicsFor(artwork) { return artwork.properties?.tags?.topic || []; }
function hasThumbnail(artwork) { return /^https?:\/\//i.test((artwork.properties?.thumbnail || '').trim()); }
function byYearAscending(a, b) {
  const ay = EcoData.parseYear(a.properties?.year);
  const by = EcoData.parseYear(b.properties?.year);
  if (ay === null && by === null) return getTitle(a).localeCompare(getTitle(b));
  if (ay === null) return 1;
  if (by === null) return -1;
  return ay - by || getTitle(a).localeCompare(getTitle(b));
}

function initEnvironment() {
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x7b6a58, 1.15));
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf2eadf, roughness: 0.88 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x8f7253, roughness: 0.72 });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xe7dccd, roughness: 0.9 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x5b4939, roughness: 0.62 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 31), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(44, 31), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 6.2, 0);
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  addWall(0, 3.1, -13.8, 44, 6.2, 0.25, wallMaterial);
  addWall(-22, 3.1, 0, 0.25, 6.2, 31, wallMaterial);
  addWall(22, 3.1, 0, 0.25, 6.2, 31, wallMaterial);
  addWall(0, 3.1, 13.8, 44, 6.2, 0.25, wallMaterial);
  [-6.7, 6.7].forEach((x) => addWall(x, 3.1, -5.2, 0.22, 6.2, 17.2, wallMaterial));
  [-13, 0, 13].forEach((x) => {
    addWall(x - 3.9, 3.1, 1.2, 4.2, 6.2, 0.24, wallMaterial);
    addWall(x + 3.9, 3.1, 1.2, 4.2, 6.2, 0.24, wallMaterial);
    addWall(x, 5.05, 1.2, 3.5, 2.3, 0.24, wallMaterial);
    addWall(x, 0.08, 1.05, 3.5, 0.16, 0.36, trimMaterial);
  });
  [-13, 0, 13].forEach((x) => addRoomLights(x));
  addRoomSign('Continents', -13, 3.6, 1.05);
  addRoomSign('Topics', 0, 3.6, 1.05);
  addRoomSign('Timeline', 13, 3.6, 1.05);
  addRoomSign('Entrance Lobby', 0, 3.6, 10.8);
}

function addWall(x, y, z, w, h, d, material) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  wall.position.set(x, y, z);
  wall.receiveShadow = true;
  wall.castShadow = true;
  scene.add(wall);
}

function addRoomLights(x) {
  const light = new THREE.SpotLight(0xffead0, 2.6, 18, Math.PI * 0.21, 0.65, 1.2);
  light.position.set(x, 5.85, -0.5);
  light.target.position.set(x, 2.1, -9.6);
  light.castShadow = true;
  scene.add(light, light.target);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 0.55), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  glow.position.set(x, 6.12, -1.5);
  scene.add(glow);
}

function addRoomSign(text, x, y, z) { createHtmlLabel(text, x, y, z, 'gallery-label--room'); }
function addTracked(object) { state.sceneObjects.push(object); scene.add(object); return object; }
function createHtmlLabel(text, x, y, z, className = '') {
  const label = document.createElement('div');
  label.className = `gallery-label ${className}`.trim();
  label.textContent = text;
  els.mount.appendChild(label);
  state.labels.push(label);
  label.userData = { position: new THREE.Vector3(x, y, z) };
  return label;
}

function clearExhibition() {
  clickable.length = 0;
  state.sceneObjects.forEach((object) => scene.remove(object));
  state.labels.filter((label) => !label.classList.contains('gallery-label--room')).forEach((label) => label.remove());
  state.labels = state.labels.filter((label) => label.classList.contains('gallery-label--room'));
  state.displayed = [];
  state.sceneObjects = [];
  state.selectedIndex = -1;
}

function textureFor(url) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), THUMBNAIL_TIMEOUT_MS);
    loader.load(url, (texture) => { clearTimeout(timer); texture.colorSpace = THREE.SRGBColorSpace; resolve(texture); }, undefined, () => { clearTimeout(timer); resolve(null); });
  });
}

async function addArtwork(artwork, position, rotationY) {
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  const artPos = position.clone().addScaledVector(normal, 0.16);
  const texture = await textureFor(artwork.properties.thumbnail.trim());
  const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0xd7b46a, emissive: 0x000000, roughness: 0.45 });
  const frame = addTracked(new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.55, 0.16), selectedMaterial));
  frame.position.copy(artPos);
  frame.rotation.y = rotationY;
  frame.castShadow = true;
  const mat = addTracked(new THREE.Mesh(new THREE.BoxGeometry(1.82, 1.34, 0.06), new THREE.MeshStandardMaterial({ color: 0xf8f2e8, roughness: 0.9 })));
  mat.position.copy(artPos).addScaledVector(normal, 0.06);
  mat.rotation.y = rotationY;
  const imageMaterial = texture ? new THREE.MeshBasicMaterial({ map: texture }) : new THREE.MeshBasicMaterial({ color: 0xb9aa96 });
  const image = addTracked(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.12), imageMaterial));
  image.position.copy(artPos).addScaledVector(normal, 0.105);
  image.rotation.y = rotationY;
  image.userData = { artwork, frame, focus: artPos.clone().addScaledVector(normal, 3.3).setY(2.15), target: artPos.clone().setY(2.05) };
  clickable.push(image);
  state.displayed.push({ artwork, object: image, frame });
  const p = artwork.properties;
  createHtmlLabel(`${p.title || 'Untitled'}\n${p.artist || 'Unknown'}${p.year ? `, ${p.year}` : ''}`, artPos.x, 1.05, artPos.z);
}

function positionsForRoom(roomKey, count) {
  const room = ROOMS[roomKey];
  const left = room.center.x - 4.2;
  const right = room.center.x + 4.2;
  const xs = [-3.6, 0, 3.6].map((offset) => room.center.x + offset);
  const positions = [];
  xs.forEach((x) => positions.push({ position: new THREE.Vector3(x, 2.35, -13.62), rotationY: 0 }));
  [-9.4, -5.6, -1.9].forEach((z) => positions.push({ position: new THREE.Vector3(left, 2.35, z), rotationY: Math.PI / 2 }));
  [-9.4, -5.6, -1.9].forEach((z) => positions.push({ position: new THREE.Vector3(right, 2.35, z), rotationY: -Math.PI / 2 }));
  return positions.slice(0, count);
}

async function layoutContinents() {
  const groups = state.artworks.reduce((acc, artwork) => {
    const continent = artwork.properties.continent || 'Other';
    if (!acc.has(continent)) acc.set(continent, []);
    acc.get(continent).push(artwork);
    return acc;
  }, new Map());
  const selected = [...groups.keys()].sort().flatMap((continent) => groups.get(continent).sort(byYearAscending).slice(0, MAX_PER_CONTINENT)).slice(0, MAX_ARTWORKS);
  const positions = positionsForRoom('continent', selected.length);
  await Promise.all(selected.map((artwork, index) => addArtwork(artwork, positions[index].position, positions[index].rotationY)));
  els.count.textContent = state.displayed.length;
}

async function layoutTopic() {
  const topic = els.topic.value;
  const selected = state.artworks
    .filter((a) => (a.properties.clusters || []).includes(topic) || topicsFor(a).includes(topic))
    .sort(byYearAscending)
    .slice(0, MAX_TOPIC_ARTWORKS);
  const positions = positionsForRoom('topic', selected.length);
  await Promise.all(selected.map((artwork, index) => addArtwork(artwork, positions[index].position, positions[index].rotationY)));
  els.count.textContent = state.displayed.length;
}

async function layoutTimeline() {
  const selected = [...state.artworks].sort(byYearAscending).slice(0, MAX_TIMELINE_ARTWORKS);
  const positions = positionsForRoom('timeline', selected.length);
  await Promise.all(selected.map((artwork, index) => addArtwork(artwork, positions[index].position, positions[index].rotationY)));
  els.count.textContent = state.displayed.length;
}

async function renderMode() {
  clearExhibition();
  els.topicControl.classList.toggle('hidden', els.mode.value !== 'topic');
  els.modeLabel.textContent = els.mode.selectedOptions[0].textContent;
  state.currentRoom = els.mode.value;
  if (els.mode.value === 'continent') await layoutContinents();
  if (els.mode.value === 'topic') await layoutTopic();
  if (els.mode.value === 'timeline') await layoutTimeline();
  focusRoom(els.mode.value);
}

function populateControls() {
  const topics = new Set(Object.keys(state.topicClusters));
  state.artworks.forEach((a) => topicsFor(a).forEach((topic) => topics.add(topic)));
  els.topic.innerHTML = [...topics].sort().map((topic) => `<option>${escapeHtml(topic)}</option>`).join('');
}

function showInfo(artwork) {
  const p = artwork.properties;
  els.info.innerHTML = `<h2 class="text-xl font-semibold">${escapeHtml(p.title || 'Untitled')}</h2><dl>
    <div><dt>Artist</dt><dd>${escapeHtml(p.artist || 'Unknown')}</dd></div>
    <div><dt>Year</dt><dd>${escapeHtml(p.year || 'Unknown')}</dd></div>
    <div><dt>Continent</dt><dd>${escapeHtml(p.continent || 'Other')}</dd></div>
    <div><dt>Location</dt><dd>${escapeHtml(p.location || 'Unknown')}</dd></div>
    <div><dt>Topics</dt><dd>${escapeHtml(topicsFor(artwork).join(', ') || 'Uncategorized')}</dd></div>
    <div><dt>Description</dt><dd>${escapeHtml((p.description || 'No description available.').slice(0, 240))}${p.description?.length > 240 ? '…' : ''}</dd></div>
    ${p.url ? `<div><dt>Source</dt><dd><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Open source link</a></dd></div>` : ''}
  </dl>`;
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

function focusRoom(roomKey) {
  const room = ROOMS[roomKey] || ROOMS.entrance;
  state.cameraGoal = { position: room.camera.clone(), target: room.target.clone() };
}

function focusOverview() {
  state.currentRoom = 'entrance';
  state.cameraGoal = { position: ROOMS.entrance.camera.clone(), target: ROOMS.entrance.target.clone() };
}

function focusArtwork(index) {
  if (!state.displayed.length) return;
  state.selectedIndex = (index + state.displayed.length) % state.displayed.length;
  state.displayed.forEach((item) => item.frame.material.emissive.setHex(0x000000));
  const item = state.displayed[state.selectedIndex];
  item.frame.material.emissive.setHex(0x332100);
  showInfo(item.artwork);
  state.cameraGoal = { position: item.object.userData.focus.clone(), target: item.object.userData.target.clone() };
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickable)[0];
  if (hit?.object.userData.artwork) focusArtwork(state.displayed.findIndex((item) => item.object === hit.object));
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
  if (state.cameraGoal) {
    camera.position.lerp(state.cameraGoal.position, 0.09);
    controls.target.lerp(state.cameraGoal.target, 0.09);
    if (camera.position.distanceTo(state.cameraGoal.position) < 0.035 && controls.target.distanceTo(state.cameraGoal.target) < 0.035) state.cameraGoal = null;
  }
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
}

async function init() {
  initEnvironment();
  const data = await EcoData.loadSharedData();
  state.topicClusters = data.topicClusters;
  state.artworks = data.artworkData.features.map((artwork) => EcoData.enrichArtwork(artwork, data)).filter(hasThumbnail);
  populateControls();
  await renderMode();
  resize();
  animate();
  focusOverview();
}

function setRoom(mode) {
  els.mode.value = mode;
  renderMode();
}

els.mode.addEventListener('change', renderMode);
els.topic.addEventListener('change', renderMode);
els.enterContinents.addEventListener('click', () => setRoom('continent'));
els.enterTopics.addEventListener('click', () => setRoom('topic'));
els.enterTimeline.addEventListener('click', () => setRoom('timeline'));
els.previous.addEventListener('click', () => focusArtwork(state.selectedIndex - 1));
els.next.addEventListener('click', () => focusArtwork(state.selectedIndex + 1));
els.overview.addEventListener('click', focusOverview);
renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', resize);

init().catch((error) => {
  els.info.innerHTML = `<h2 class="text-xl font-semibold">Exhibition unavailable</h2><p class="mt-2 text-sm opacity-75">${escapeHtml(error.message)}</p>`;
  console.error(error);
});
