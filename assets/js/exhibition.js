import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js';

const EcoData = window.EcoData;

const MAX_TOTAL_ARTWORKS = 56;
const MAX_PER_CONTINENT = 8;
const MAX_TOPIC_ARTWORKS = 18;
const THUMBNAIL_TIMEOUT_MS = 6500;
const MONTH_SEED = new Date().toISOString().slice(0, 7);

const GALLERIES = {
  continent: {
    name: 'Continent Gallery',
    shortName: 'Continent',
    center: new THREE.Vector3(-13.5, 0, -6.6),
    overview: new THREE.Vector3(-13.5, 3.45, 2.1),
    target: new THREE.Vector3(-13.5, 2.0, -8.8)
  },
  topic: {
    name: 'Topic Gallery',
    shortName: 'Topic',
    center: new THREE.Vector3(0, 0, -7.2),
    overview: new THREE.Vector3(0, 3.55, 1.8),
    target: new THREE.Vector3(0, 2.0, -9.1)
  },
  timeline: {
    name: 'Timeline Gallery',
    shortName: 'Timeline',
    center: new THREE.Vector3(13.5, 0, -6.6),
    overview: new THREE.Vector3(13.5, 3.45, 2.1),
    target: new THREE.Vector3(13.5, 2.0, -8.8)
  }
};

const state = {
  artworks: [],
  topicClusters: {},
  architectureObjects: [],
  artworkObjects: [],
  labels: [],
  artworkLabels: [],
  displayed: [],
  selectedIndex: -1,
  currentGallery: 'continent',
  cameraGoal: null,
  renderToken: 0
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
  info: document.getElementById('artworkInfo'),
  enterContinents: document.getElementById('enterContinents'),
  enterTopics: document.getElementById('enterTopics'),
  enterTimeline: document.getElementById('enterTimeline')
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
els.mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171512);
scene.fog = new THREE.Fog(0x171512, 24, 58);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 90);
camera.position.set(0, 4.1, 11.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 3.4;
controls.maxDistance = 11;
controls.minPolarAngle = Math.PI * 0.31;
controls.maxPolarAngle = Math.PI * 0.54;
controls.minAzimuthAngle = -Math.PI * 0.24;
controls.maxAzimuthAngle = Math.PI * 0.24;
controls.target.set(0, 1.9, -1.7);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickable = [];
const selectedFrameMaterial = new THREE.MeshStandardMaterial({
  color: 0xd9b56a,
  emissive: 0x5d3a0b,
  metalness: 0.12,
  roughness: 0.32
});

function getTitle(artwork) {
  return artwork.properties?.title || 'Untitled';
}

function hasThumbnail(artwork) {
  return /^https?:\/\//i.test((artwork.properties?.thumbnail || '').trim());
}

function topicsFor(artwork) {
  return artwork.properties?.tags?.topic || [];
}

function yearValue(artwork) {
  return EcoData.parseYear(artwork.properties?.year);
}

function byYearAscending(a, b) {
  const ay = yearValue(a);
  const by = yearValue(b);
  if (ay === null && by === null) return getTitle(a).localeCompare(getTitle(b));
  if (ay === null) return 1;
  if (by === null) return -1;
  return ay - by || getTitle(a).localeCompare(getTitle(b));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function monthlyRotate(items, key) {
  const random = seededRandom(hashString(`${MONTH_SEED}:${key}`));
  return [...items]
    .map((item) => ({ item, rank: random() }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
}

function trackArchitecture(object) {
  state.architectureObjects.push(object);
  scene.add(object);
  return object;
}

function trackArtwork(object) {
  state.artworkObjects.push(object);
  scene.add(object);
  return object;
}

function addBox({ size, position, material, castShadow = true, receiveShadow = true }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return trackArchitecture(mesh);
}

function initArchitecture() {
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xeee5d8, roughness: 0.86 });
  const sideWallMaterial = new THREE.MeshStandardMaterial({ color: 0xe2d7ca, roughness: 0.88 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x5f5145, roughness: 0.68, metalness: 0.03 });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d0c4, roughness: 0.9 });
  const darkTrimMaterial = new THREE.MeshStandardMaterial({ color: 0x25221e, roughness: 0.42, metalness: 0.14 });
  const brassMaterial = new THREE.MeshStandardMaterial({ color: 0xb99655, roughness: 0.36, metalness: 0.35 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xf6dca7, transparent: true, opacity: 0.46 });

  scene.add(new THREE.HemisphereLight(0xfff3dd, 0x322a24, 1.45));
  scene.add(new THREE.AmbientLight(0xffead2, 0.55));

  addBox({ size: [44, 0.2, 31], position: [0, 0, -3.4], material: floorMaterial, castShadow: false });
  addBox({ size: [44, 0.18, 31], position: [0, 5.65, -3.4], material: ceilingMaterial, castShadow: false });

  addBox({ size: [44, 5.65, 0.28], position: [0, 2.82, -18.9], material: wallMaterial });
  addBox({ size: [44, 5.65, 0.28], position: [0, 2.82, 12.1], material: sideWallMaterial });
  addBox({ size: [0.28, 5.65, 31], position: [-22, 2.82, -3.4], material: sideWallMaterial });
  addBox({ size: [0.28, 5.65, 31], position: [22, 2.82, -3.4], material: sideWallMaterial });

  [-7.2, 7.2].forEach((x) => {
    addBox({ size: [0.22, 5.65, 19.5], position: [x, 2.82, -8.2], material: wallMaterial });
    addBox({ size: [0.42, 0.22, 19.5], position: [x, 5.55, -8.2], material: darkTrimMaterial });
  });

  [-13.5, 0, 13.5].forEach((x) => {
    addBox({ size: [8.7, 5.65, 0.24], position: [x, 2.82, 1.55], material: wallMaterial });
    addBox({ size: [3.0, 0.34, 0.36], position: [x, 3.72, 1.36], material: brassMaterial });
    addBox({ size: [0.08, 4.6, 0.08], position: [x - 4.25, 2.55, 1.18], material: darkTrimMaterial });
    addBox({ size: [0.08, 4.6, 0.08], position: [x + 4.25, 2.55, 1.18], material: darkTrimMaterial });
  });

  addBox({ size: [14, 0.06, 0.12], position: [0, 0.05, 5.4], material: glowMaterial, castShadow: false, receiveShadow: false });
  addBox({ size: [36, 0.06, 0.12], position: [0, 0.06, -3.5], material: glowMaterial, castShadow: false, receiveShadow: false });

  Object.values(GALLERIES).forEach((gallery) => {
    addSpotlight(gallery.center.x - 3.0, 5.25, -6.0, gallery.center.x - 2.0, 1.85, -17.7, 2.2);
    addSpotlight(gallery.center.x + 3.0, 5.25, -6.0, gallery.center.x + 2.0, 1.85, -17.7, 2.2);
    addSpotlight(gallery.center.x, 5.35, -1.1, gallery.center.x, 1.75, -7.6, 1.4);
  });
  addSpotlight(0, 5.2, 7.4, 0, 1.6, 1.2, 1.6);

  createLabel('Continent Gallery', -13.5, 4.1, 1.2, 'gallery-label--room', true);
  createLabel('Topic Gallery', 0, 4.1, 1.2, 'gallery-label--room', true);
  createLabel('Timeline Gallery', 13.5, 4.1, 1.2, 'gallery-label--room', true);
}

function addSpotlight(x, y, z, targetX, targetY, targetZ, intensity) {
  const light = new THREE.SpotLight(0xffe6c2, intensity, 23, Math.PI * 0.16, 0.58, 1.3);
  light.position.set(x, y, z);
  light.target.position.set(targetX, targetY, targetZ);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  scene.add(light, light.target);
}

function createLabel(text, x, y, z, className = '', persistent = false) {
  const label = document.createElement('div');
  label.className = `gallery-label ${className}`.trim();
  label.textContent = text;
  label.userData = { position: new THREE.Vector3(x, y, z) };
  els.mount.appendChild(label);
  state.labels.push(label);
  if (!persistent) state.artworkLabels.push(label);
  return label;
}

function textureFor(url) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), THUMBNAIL_TIMEOUT_MS);
    loader.load(
      url,
      (texture) => {
        clearTimeout(timer);
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

function clearArtworkDisplay() {
  clickable.length = 0;
  state.artworkObjects.forEach((object) => scene.remove(object));
  state.artworkObjects = [];
  state.artworkLabels.forEach((label) => label.remove());
  state.labels = state.labels.filter((label) => !state.artworkLabels.includes(label));
  state.artworkLabels = [];
  state.displayed = [];
  state.selectedIndex = -1;
}

function selectForGallery(galleryKey) {
  if (galleryKey === 'continent') {
    const groups = new Map();
    state.artworks.forEach((artwork) => {
      const continent = artwork.properties.continent || 'Other';
      if (!groups.has(continent)) groups.set(continent, []);
      groups.get(continent).push(artwork);
    });

    return [...groups.keys()].sort().flatMap((continent) => (
      monthlyRotate(groups.get(continent), `continent:${continent}`)
        .slice(0, MAX_PER_CONTINENT)
        .sort(byYearAscending)
    )).slice(0, MAX_TOTAL_ARTWORKS);
  }

  if (galleryKey === 'topic') {
    return monthlyRotate(
      state.artworks.filter((artwork) => (
        (artwork.properties.clusters || []).includes(els.topic.value) || topicsFor(artwork).includes(els.topic.value)
      )),
      `topic:${els.topic.value}`
    ).slice(0, MAX_TOPIC_ARTWORKS).sort(byYearAscending);
  }

  return monthlyRotate(state.artworks, 'timeline')
    .slice(0, MAX_TOTAL_ARTWORKS)
    .sort(byYearAscending);
}

function slotsForGallery(galleryKey, count) {
  const centerX = GALLERIES[galleryKey].center.x;
  const slots = [];

  [-4.2, -1.4, 1.4, 4.2].forEach((offsetX) => {
    slots.push({ x: centerX + offsetX, z: -18.68, rotationY: 0 });
  });

  [-15.4, -12.5, -9.6, -6.7].forEach((z) => {
    slots.push({ x: centerX - 6.95, z, rotationY: Math.PI / 2 });
  });

  [-15.4, -12.5, -9.6, -6.7].forEach((z) => {
    slots.push({ x: centerX + 6.95, z, rotationY: -Math.PI / 2 });
  });

  [-3.1, 0, 3.1].forEach((offsetX) => {
    slots.push({ x: centerX + offsetX, z: 1.34, rotationY: Math.PI });
  });

  return slots.slice(0, count);
}

async function addArtwork(artwork, slot) {
  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotationY);
  const wallPosition = new THREE.Vector3(slot.x, 2.42, slot.z).addScaledVector(normal, 0.1);
  const texture = await textureFor(artwork.properties.thumbnail.trim());

  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x211f1c, roughness: 0.38, metalness: 0.12 });
  const frame = trackArtwork(new THREE.Mesh(new THREE.BoxGeometry(2.28, 1.76, 0.14), frameMaterial));
  frame.position.copy(wallPosition);
  frame.rotation.y = slot.rotationY;
  frame.castShadow = true;
  frame.userData.defaultMaterial = frameMaterial;

  const matBoard = trackArtwork(new THREE.Mesh(
    new THREE.BoxGeometry(2.02, 1.5, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xf8f1e7, roughness: 0.92 })
  ));
  matBoard.position.copy(wallPosition).addScaledVector(normal, 0.055);
  matBoard.rotation.y = slot.rotationY;

  const imageMaterial = texture
    ? new THREE.MeshBasicMaterial({ map: texture })
    : new THREE.MeshBasicMaterial({ color: 0xb9aa98 });
  const image = trackArtwork(new THREE.Mesh(new THREE.PlaneGeometry(1.78, 1.24), imageMaterial));
  image.position.copy(wallPosition).addScaledVector(normal, 0.095);
  image.rotation.y = slot.rotationY;
  image.userData = {
    artwork,
    frame,
    focus: wallPosition.clone().addScaledVector(normal, 3.45).setY(2.35),
    target: wallPosition.clone()
  };

  clickable.push(image);
  state.displayed.push({ artwork, object: image });

  const props = artwork.properties;
  createLabel(
    `${props.title || 'Untitled'}\n${props.artist || 'Unknown'}${props.year ? `, ${props.year}` : ''}`,
    wallPosition.x,
    1.05,
    wallPosition.z
  );
}

async function renderGallery(galleryKey) {
  const token = state.renderToken + 1;
  state.renderToken = token;
  state.currentGallery = galleryKey;
  els.mode.value = galleryKey;
  els.topicControl.classList.toggle('hidden', galleryKey !== 'topic');
  els.modeLabel.textContent = GALLERIES[galleryKey].name;
  clearArtworkDisplay();

  const selection = selectForGallery(galleryKey);
  const slots = slotsForGallery(galleryKey, selection.length);
  els.count.textContent = slots.length;

  for (let index = 0; index < slots.length; index += 1) {
    if (state.renderToken !== token) return;
    await addArtwork(selection[index], slots[index]);
  }

  focusGallery(galleryKey);
}

function populateTopicControl() {
  const topics = new Set(Object.keys(state.topicClusters));
  state.artworks.forEach((artwork) => topicsFor(artwork).forEach((topic) => topics.add(topic)));
  els.topic.innerHTML = [...topics].sort().map((topic) => `<option>${escapeHtml(topic)}</option>`).join('');
}

function showInfo(artwork) {
  const props = artwork.properties;
  els.info.innerHTML = `<h2 class="text-xl font-semibold">${escapeHtml(props.title || 'Untitled')}</h2><dl>
    <div><dt>Artist</dt><dd>${escapeHtml(props.artist || 'Unknown')}</dd></div>
    <div><dt>Year</dt><dd>${escapeHtml(props.year || 'Unknown')}</dd></div>
    <div><dt>Continent</dt><dd>${escapeHtml(props.continent || 'Other')}</dd></div>
    <div><dt>Location</dt><dd>${escapeHtml(props.location || 'Unknown')}</dd></div>
    <div><dt>Topics</dt><dd>${escapeHtml(topicsFor(artwork).join(', ') || 'Uncategorized')}</dd></div>
    <div><dt>Description</dt><dd>${escapeHtml((props.description || 'No description available.').slice(0, 240))}${props.description?.length > 240 ? '…' : ''}</dd></div>
    ${props.url ? `<div><dt>Source</dt><dd><a href="${escapeHtml(props.url)}" target="_blank" rel="noopener">Open source link</a></dd></div>` : ''}
  </dl>`;
}

function updateSelectionHighlight() {
  state.displayed.forEach((item, index) => {
    const frame = item.object.userData.frame;
    frame.material = index === state.selectedIndex ? selectedFrameMaterial : frame.userData.defaultMaterial;
  });
}

function focusArtwork(index) {
  if (!state.displayed.length) return;
  state.selectedIndex = (index + state.displayed.length) % state.displayed.length;
  const item = state.displayed[state.selectedIndex];
  showInfo(item.artwork);
  updateSelectionHighlight();
  state.cameraGoal = {
    position: item.object.userData.focus,
    target: item.object.userData.target
  };
}

function focusGallery(galleryKey) {
  const gallery = GALLERIES[galleryKey];
  state.cameraGoal = {
    position: gallery.overview.clone(),
    target: gallery.target.clone()
  };
}

function focusEntrance() {
  els.modeLabel.textContent = 'Entrance';
  state.cameraGoal = {
    position: new THREE.Vector3(0, 4.1, 11.6),
    target: new THREE.Vector3(0, 1.9, -1.7)
  };
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickable)[0];
  if (hit?.object.userData.artwork) {
    focusArtwork(state.displayed.findIndex((item) => item.object === hit.object));
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
    label.style.display = projected.z > 1 || Math.abs(projected.x) > 1.12 || Math.abs(projected.y) > 1.12 ? 'none' : '';
  });
}

function animate() {
  requestAnimationFrame(animate);
  if (state.cameraGoal) {
    camera.position.lerp(state.cameraGoal.position, 0.085);
    controls.target.lerp(state.cameraGoal.target, 0.085);
    if (camera.position.distanceTo(state.cameraGoal.position) < 0.035 && controls.target.distanceTo(state.cameraGoal.target) < 0.035) {
      state.cameraGoal = null;
    }
  }
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
}

async function init() {
  initArchitecture();
  const data = await EcoData.loadSharedData();
  state.topicClusters = data.topicClusters;
  state.artworks = data.artworkData.features
    .map((artwork) => EcoData.enrichArtwork(artwork, data))
    .filter(hasThumbnail);

  populateTopicControl();
  await renderGallery('continent');
  focusEntrance();
  resize();
  animate();
}

els.mode.addEventListener('change', () => renderGallery(els.mode.value));
els.topic.addEventListener('change', () => renderGallery('topic'));
els.enterContinents.addEventListener('click', () => renderGallery('continent'));
els.enterTopics.addEventListener('click', () => renderGallery('topic'));
els.enterTimeline.addEventListener('click', () => renderGallery('timeline'));
els.previous.addEventListener('click', () => focusArtwork(state.selectedIndex - 1));
els.next.addEventListener('click', () => focusArtwork(state.selectedIndex + 1));
els.overview.addEventListener('click', focusEntrance);
renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', resize);

init().catch((error) => {
  els.info.innerHTML = `<h2 class="text-xl font-semibold">Exhibition unavailable</h2><p class="mt-2 text-sm opacity-75">${escapeHtml(error.message)}</p>`;
  console.error(error);
});
