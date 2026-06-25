import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js';

const EcoData = window.EcoData;

const MAX_ARTWORKS = 28;
const MAX_PER_CONTINENT = 5;
const THUMBNAIL_TIMEOUT_MS = 8000;
const state = {
  artworks: [],
  topicClusters: {},
  sceneObjects: [],
  labels: [],
  displayed: [],
  selectedIndex: -1,
  cameraGoal: null
};

const els = {
  mount: document.getElementById('exhibitionCanvas'),
  mode: document.getElementById('exhibitionMode'),
  topicControl: document.getElementById('topicControl'),
  topic: document.getElementById('topicSelect'),
  previous: document.getElementById('previousArtwork'),
  next: document.getElementById('nextArtwork'),
  overview: document.getElementById('overviewGallery'),
  count: document.getElementById('exhibitionCount'),
  modeLabel: document.getElementById('exhibitionModeLabel'),
  info: document.getElementById('artworkInfo')
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
els.mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeee6da);
scene.fog = new THREE.Fog(0xeee6da, 24, 58);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
camera.position.set(0, 4.2, 15.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minPolarAngle = Math.PI * 0.28;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minAzimuthAngle = -Math.PI * 0.45;
controls.maxAzimuthAngle = Math.PI * 0.45;
controls.minDistance = 6;
controls.maxDistance = 19;
controls.target.set(0, 1.8, -2.4);

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
  scene.add(new THREE.HemisphereLight(0xfffbef, 0x97836b, 1.4));
  addSpotLight(-6.5, 7.5, 2, -4, 1.7, -7);
  addSpotLight(0, 7.8, 1.5, 0, 1.7, -8);
  addSpotLight(6.5, 7.5, 2, 4, 1.7, -7);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf4eee4, roughness: 0.86 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xb59a79, roughness: 0.78 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(36, 7.2, 0.28), wallMaterial);
  backWall.position.set(0, 3.6, -10.5);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 7.2, 24), wallMaterial);
  leftWall.position.set(-18, 3.6, 1.2);
  const rightWall = leftWall.clone();
  rightWall.position.x = 18;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(38, 28), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 1.5;
  [backWall, leftWall, rightWall, floor].forEach((object) => {
    object.receiveShadow = true;
    scene.add(object);
  });

  const ceilingGlow = new THREE.Mesh(new THREE.PlaneGeometry(34, 9), new THREE.MeshBasicMaterial({ color: 0xfff5df, transparent: true, opacity: 0.14 }));
  ceilingGlow.rotation.x = Math.PI / 2;
  ceilingGlow.position.set(0, 7.18, -3);
  scene.add(ceilingGlow);
}

function addSpotLight(x, y, z, tx, ty, tz) {
  const light = new THREE.SpotLight(0xffead0, 2.8, 26, Math.PI * 0.18, 0.6, 1.4);
  light.position.set(x, y, z);
  light.target.position.set(tx, ty, tz);
  light.castShadow = true;
  scene.add(light, light.target);
}

function clearExhibition() {
  clickable.length = 0;
  state.sceneObjects.forEach((object) => scene.remove(object));
  state.labels.forEach((label) => label.remove());
  state.sceneObjects = [];
  state.labels = [];
  state.displayed = [];
  state.selectedIndex = -1;
}

function addTracked(object) { state.sceneObjects.push(object); scene.add(object); return object; }

function createWallSection(x, z, rotationY, width = 5.6, label = '') {
  const panel = addTracked(new THREE.Mesh(new THREE.BoxGeometry(width, 3.75, 0.2), new THREE.MeshStandardMaterial({ color: 0xf8f4ec, roughness: 0.82 })));
  panel.position.set(x, 2.28, z);
  panel.rotation.y = rotationY;
  panel.receiveShadow = true;
  if (label) createHtmlLabel(label, x, 4.45, z, 'gallery-label--section');
  return panel;
}

function createHtmlLabel(text, x, y, z, className = '') {
  const label = document.createElement('div');
  label.className = `gallery-label ${className}`.trim();
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

async function addArtwork(artwork, x, z, rotationY, sectionLabel = '') {
  createWallSection(x, z, rotationY, 4.6, sectionLabel);
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  const artPos = new THREE.Vector3(x, 2.35, z).addScaledVector(normal, 0.14);
  const texture = await textureFor(artwork.properties.thumbnail.trim());
  if (!texture) return;

  const frame = addTracked(new THREE.Mesh(new THREE.BoxGeometry(2.28, 1.76, 0.16), new THREE.MeshStandardMaterial({ color: 0x2e2822, metalness: 0.08, roughness: 0.48 })));
  frame.position.copy(artPos);
  frame.rotation.y = rotationY;
  frame.castShadow = true;
  const mat = addTracked(new THREE.Mesh(new THREE.BoxGeometry(2.06, 1.54, 0.06), new THREE.MeshStandardMaterial({ color: 0xf7f2e9, roughness: 0.9 })));
  mat.position.copy(artPos).addScaledVector(normal, 0.06);
  mat.rotation.y = rotationY;
  const image = addTracked(new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.3), new THREE.MeshBasicMaterial({ map: texture })));
  image.position.copy(artPos).addScaledVector(normal, 0.105);
  image.rotation.y = rotationY;
  image.userData.artwork = artwork;
  image.userData.focus = artPos.clone().addScaledVector(normal, 4.6).setY(2.35);
  image.userData.target = artPos.clone();
  clickable.push(image);
  state.displayed.push({ artwork, object: image });

  const p = artwork.properties;
  createHtmlLabel(`${p.title || 'Untitled'}\n${p.artist || 'Unknown'}${p.year ? `, ${p.year}` : ''}`, artPos.x, 0.82, artPos.z);
}

function galleryPositions(count) {
  const positions = [];
  const perRow = Math.min(7, Math.max(3, Math.ceil(Math.sqrt(count))));
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    positions.push({ x: (col - (perRow - 1) / 2) * 4.8, z: -10.2 + row * 4.7, rotationY: 0 });
  }
  return positions;
}

function layoutLine(artworks, heading) {
  createHtmlLabel(heading, 0, 5.0, -10.2, 'gallery-label--section');
  const selected = artworks.slice(0, MAX_ARTWORKS);
  galleryPositions(selected.length).forEach((pos, index) => addArtwork(selected[index], pos.x, pos.z, pos.rotationY));
  els.count.textContent = selected.length;
}

function layoutContinents() {
  const groups = state.artworks.reduce((acc, artwork) => {
    const continent = artwork.properties.continent || 'Other';
    if (!acc.has(continent)) acc.set(continent, []);
    acc.get(continent).push(artwork);
    return acc;
  }, new Map());
  const continents = [...groups.keys()].sort();
  const positions = galleryPositions(continents.length * MAX_PER_CONTINENT);
  let used = 0;
  continents.forEach((continent) => {
    groups.get(continent).sort(byYearAscending).slice(0, MAX_PER_CONTINENT).forEach((artwork, index) => {
      const pos = positions[used];
      addArtwork(artwork, pos.x, pos.z, pos.rotationY, index === 0 ? continent : '');
      used += 1;
    });
  });
  els.count.textContent = used;
}

function currentSelection() {
  if (els.mode.value === 'continent') return null;
  if (els.mode.value === 'topic') return state.artworks.filter((a) => a.properties.clusters.includes(els.topic.value) || topicsFor(a).includes(els.topic.value)).sort(byYearAscending);
  return [...state.artworks].sort(byYearAscending);
}

function renderMode() {
  clearExhibition();
  els.topicControl.classList.toggle('hidden', els.mode.value !== 'topic');
  els.modeLabel.textContent = els.mode.selectedOptions[0].textContent;
  if (els.mode.value === 'continent') layoutContinents();
  else {
    const selected = currentSelection();
    layoutLine(selected, els.mode.value === 'timeline' ? 'Chronological gallery path' : els.topic.value);
  }
  focusOverview();
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

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function focusArtwork(index) {
  if (!state.displayed.length) return;
  state.selectedIndex = (index + state.displayed.length) % state.displayed.length;
  const item = state.displayed[state.selectedIndex];
  showInfo(item.artwork);
  state.cameraGoal = {
    position: item.object.userData.focus,
    target: item.object.userData.target
  };
}

function focusOverview() {
  state.cameraGoal = {
    position: new THREE.Vector3(0, 4.2, 15.5),
    target: new THREE.Vector3(0, 1.85, -3.2)
  };
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickable)[0];
  if (hit?.object.userData.artwork) {
    const index = state.displayed.findIndex((item) => item.object === hit.object);
    focusArtwork(index);
  }
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
    camera.position.lerp(state.cameraGoal.position, 0.075);
    controls.target.lerp(state.cameraGoal.target, 0.075);
    if (camera.position.distanceTo(state.cameraGoal.position) < 0.04 && controls.target.distanceTo(state.cameraGoal.target) < 0.04) state.cameraGoal = null;
  }
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
els.topic.addEventListener('change', renderMode);
els.previous.addEventListener('click', () => focusArtwork(state.selectedIndex - 1));
els.next.addEventListener('click', () => focusArtwork(state.selectedIndex + 1));
els.overview.addEventListener('click', focusOverview);
renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', resize);

init().catch((error) => {
  els.info.innerHTML = `<h2 class="text-xl font-semibold">Exhibition unavailable</h2><p class="mt-2 text-sm opacity-75">${escapeHtml(error.message)}</p>`;
  console.error(error);
});
