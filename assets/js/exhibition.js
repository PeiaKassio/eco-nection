import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js';

const EcoData = window.EcoData;
const MAX_ARTWORKS = 30;
const MAX_PER_CONTINENT = 3;
const MAX_ROOM_ARTWORKS = 10;
const THUMBNAIL_TIMEOUT_MS = 6500;

const ROOMS = {
  continent: { name: 'Continents', center: new THREE.Vector3(-11, 0, -5.5), overview: new THREE.Vector3(-11, 3.2, 1.8), target: new THREE.Vector3(-11, 2, -7.8) },
  topic: { name: 'Topics', center: new THREE.Vector3(0, 0, -5.5), overview: new THREE.Vector3(0, 3.2, 1.8), target: new THREE.Vector3(0, 2, -7.8) },
  timeline: { name: 'Timeline', center: new THREE.Vector3(11, 0, -5.5), overview: new THREE.Vector3(11, 3.2, 1.8), target: new THREE.Vector3(11, 2, -7.8) }
};

const state = { artworks: [], topicClusters: {}, roomObjects: [], labels: [], artLabels: [], displayed: [], selectedIndex: -1, currentRoom: 'continent', cameraGoal: null };
const els = {
  mount: document.getElementById('exhibitionCanvas'), mode: document.getElementById('exhibitionMode'), topicControl: document.getElementById('topicControl'), topic: document.getElementById('topicSelect'),
  previous: document.getElementById('previousArtwork'), next: document.getElementById('nextArtwork'), overview: document.getElementById('overviewGallery'), count: document.getElementById('exhibitionCount'), modeLabel: document.getElementById('exhibitionModeLabel'), info: document.getElementById('artworkInfo'),
  enterContinents: document.getElementById('enterContinents'), enterTopics: document.getElementById('enterTopics'), enterTimeline: document.getElementById('enterTimeline')
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
els.mount.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8ded1);
scene.fog = new THREE.Fog(0xe8ded1, 22, 48);
const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 90);
camera.position.set(0, 3.8, 9.8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 3.2;
controls.maxDistance = 10;
controls.minPolarAngle = Math.PI * 0.31;
controls.maxPolarAngle = Math.PI * 0.53;
controls.minAzimuthAngle = -Math.PI * 0.28;
controls.maxAzimuthAngle = Math.PI * 0.28;
controls.target.set(0, 1.8, -1.5);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickable = [];
const highlightMaterial = new THREE.MeshStandardMaterial({ color: 0xd3a44c, emissive: 0x553700, roughness: 0.35 });

function getTitle(a) { return a.properties?.title || 'Untitled'; }
function hasThumbnail(a) { return /^https?:\/\//i.test((a.properties?.thumbnail || '').trim()); }
function topicsFor(a) { return a.properties?.tags?.topic || []; }
function yearValue(a) { return EcoData.parseYear(a.properties?.year); }
function byYearAscending(a, b) { const ay = yearValue(a); const by = yearValue(b); if (ay === null && by === null) return getTitle(a).localeCompare(getTitle(b)); if (ay === null) return 1; if (by === null) return -1; return ay - by || getTitle(a).localeCompare(getTitle(b)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function addTracked(o) { state.roomObjects.push(o); scene.add(o); return o; }

function initEnvironment() {
  scene.add(new THREE.HemisphereLight(0xfff8e8, 0x7f6b56, 1.55));
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1eadf, roughness: 0.88 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8b6f55, roughness: 0.72 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xe7ded2, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6f5845, roughness: 0.62 });
  const addBox = (size, pos, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); m.position.set(...pos); m.receiveShadow = true; m.castShadow = true; scene.add(m); return m; };
  addBox([36, 0.18, 24], [0, 0, -1.6], floorMat);
  addBox([36, 0.16, 24], [0, 5.1, -1.6], ceilingMat);
  addBox([36, 5.1, 0.22], [0, 2.55, -13.5], wallMat);
  addBox([0.22, 5.1, 24], [-18, 2.55, -1.6], wallMat); addBox([0.22, 5.1, 24], [18, 2.55, -1.6], wallMat);
  addBox([36, 5.1, 0.22], [0, 2.55, 10.3], wallMat);
  [-5.5, 5.5].forEach((x) => addBox([0.18, 5.1, 15], [x, 2.55, -6], wallMat));
  [-11, 0, 11].forEach((x) => { addBox([6.8, 5.1, 0.18], [x, 2.55, 1.1], wallMat); addBox([2.2, 0.28, 0.28], [x, 3.55, 1.0], trimMat); });
  Object.values(ROOMS).forEach((room) => { addSpot(room.center.x - 2.8, 4.75, -4.8, room.center.x, 1.7, -10.8); addSpot(room.center.x + 2.8, 4.75, -4.8, room.center.x, 1.7, -10.8); });
  addSpot(0, 4.6, 6.5, 0, 1.5, 1.2);
  createHtmlLabel('Continents', -11, 3.9, 0.85, 'gallery-label--section', true); createHtmlLabel('Topics', 0, 3.9, 0.85, 'gallery-label--section', true); createHtmlLabel('Timeline', 11, 3.9, 0.85, 'gallery-label--section', true);
}
function addSpot(x, y, z, tx, ty, tz) { const l = new THREE.SpotLight(0xffead0, 2.6, 20, Math.PI * 0.2, 0.55, 1.35); l.position.set(x, y, z); l.target.position.set(tx, ty, tz); l.castShadow = true; scene.add(l, l.target); }
function createHtmlLabel(text, x, y, z, className = '', persistent = false) { const label = document.createElement('div'); label.className = `gallery-label ${className}`.trim(); label.textContent = text; els.mount.appendChild(label); state.labels.push(label); if (!persistent) state.artLabels.push(label); label.userData = { position: new THREE.Vector3(x, y, z) }; return label; }
function textureFor(url) { const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous'); return new Promise((resolve) => { const timer = setTimeout(() => resolve(null), THUMBNAIL_TIMEOUT_MS); loader.load(url, (t) => { clearTimeout(timer); t.colorSpace = THREE.SRGBColorSpace; resolve(t); }, undefined, () => { clearTimeout(timer); resolve(null); }); }); }

function clearArtworkObjects() { clickable.length = 0; state.roomObjects.forEach((o) => scene.remove(o)); state.roomObjects = []; state.artLabels.forEach((l) => l.remove()); state.labels = state.labels.filter((l) => !state.artLabels.includes(l)); state.artLabels = []; state.displayed = []; state.selectedIndex = -1; }
function roomSelection(roomKey) { if (roomKey === 'continent') { const groups = new Map(); state.artworks.forEach((a) => { const c = a.properties.continent || 'Other'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(a); }); return [...groups.keys()].sort().flatMap((c) => groups.get(c).sort(byYearAscending).slice(0, MAX_PER_CONTINENT)).slice(0, MAX_ARTWORKS); } if (roomKey === 'topic') { return state.artworks.filter((a) => (a.properties.clusters || []).includes(els.topic.value) || topicsFor(a).includes(els.topic.value)).sort(byYearAscending).slice(0, MAX_ROOM_ARTWORKS); } return [...state.artworks].sort(byYearAscending).slice(0, MAX_ARTWORKS); }
function wallSlots(roomKey, count) { const cx = ROOMS[roomKey].center.x; const xs = [-3, 0, 3]; const slots = []; xs.forEach((dx) => slots.push({ x: cx + dx, z: -13.32, ry: 0, label: dx === -3 })); [-9.5, -6.5].forEach((z) => slots.push({ x: cx - 5.38, z, ry: Math.PI / 2 })); [-9.5, -6.5].forEach((z) => slots.push({ x: cx + 5.38, z, ry: -Math.PI / 2 })); [-1.6, 1.6].forEach((dx) => slots.push({ x: cx + dx, z: 0.92, ry: Math.PI })); return slots.slice(0, count); }
async function addArtwork(artwork, slot, roomKey, index) { const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.ry); const pos = new THREE.Vector3(slot.x, 2.35, slot.z).addScaledVector(normal, 0.09); const texture = await textureFor(artwork.properties.thumbnail.trim()); const frame = addTracked(new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.72, 0.13), new THREE.MeshStandardMaterial({ color: 0x2d2823, roughness: 0.45 }))); frame.position.copy(pos); frame.rotation.y = slot.ry; frame.userData.defaultMaterial = frame.material; const mat = addTracked(new THREE.Mesh(new THREE.BoxGeometry(2.02, 1.49, 0.05), new THREE.MeshStandardMaterial({ color: 0xf7f1e8, roughness: 0.9 }))); mat.position.copy(pos).addScaledVector(normal, 0.055); mat.rotation.y = slot.ry; const imageMat = texture ? new THREE.MeshBasicMaterial({ map: texture }) : new THREE.MeshBasicMaterial({ color: 0xc9bba9 }); const image = addTracked(new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.22), imageMat)); image.position.copy(pos).addScaledVector(normal, 0.095); image.rotation.y = slot.ry; image.userData = { artwork, frame, focus: pos.clone().addScaledVector(normal, 3.5).setY(2.25), target: pos.clone() }; clickable.push(image); state.displayed.push({ artwork, object: image, roomKey }); const p = artwork.properties; createHtmlLabel(`${p.title || 'Untitled'}\n${p.artist || 'Unknown'}${p.year ? `, ${p.year}` : ''}`, pos.x, 1.03, pos.z); if (slot.label) createHtmlLabel(ROOMS[roomKey].name, pos.x, 4.35, pos.z, 'gallery-label--section'); }
async function renderRoom(roomKey) { state.currentRoom = roomKey; els.mode.value = roomKey; els.topicControl.classList.toggle('hidden', roomKey !== 'topic'); els.modeLabel.textContent = ROOMS[roomKey].name; clearArtworkObjects(); const selected = roomSelection(roomKey); els.count.textContent = selected.length; await Promise.all(wallSlots(roomKey, selected.length).map((slot, i) => addArtwork(selected[i], slot, roomKey, i))); focusRoom(roomKey); }
function populateControls() { const topics = new Set(Object.keys(state.topicClusters)); state.artworks.forEach((a) => topicsFor(a).forEach((t) => topics.add(t))); els.topic.innerHTML = [...topics].sort().map((t) => `<option>${escapeHtml(t)}</option>`).join(''); }
function showInfo(artwork) { const p = artwork.properties; els.info.innerHTML = `<h2 class="text-xl font-semibold">${escapeHtml(p.title || 'Untitled')}</h2><dl><div><dt>Artist</dt><dd>${escapeHtml(p.artist || 'Unknown')}</dd></div><div><dt>Year</dt><dd>${escapeHtml(p.year || 'Unknown')}</dd></div><div><dt>Continent</dt><dd>${escapeHtml(p.continent || 'Other')}</dd></div><div><dt>Location</dt><dd>${escapeHtml(p.location || 'Unknown')}</dd></div><div><dt>Topics</dt><dd>${escapeHtml(topicsFor(artwork).join(', ') || 'Uncategorized')}</dd></div><div><dt>Description</dt><dd>${escapeHtml((p.description || 'No description available.').slice(0, 240))}${p.description?.length > 240 ? '…' : ''}</dd></div>${p.url ? `<div><dt>Source</dt><dd><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">Open source link</a></dd></div>` : ''}</dl>`; }
function applyHighlight() { state.displayed.forEach((item, i) => { item.object.userData.frame.material = i === state.selectedIndex ? highlightMaterial : item.object.userData.frame.userData.defaultMaterial; }); }
function focusArtwork(index) { if (!state.displayed.length) return; state.selectedIndex = (index + state.displayed.length) % state.displayed.length; const item = state.displayed[state.selectedIndex]; showInfo(item.artwork); applyHighlight(); state.cameraGoal = { position: item.object.userData.focus, target: item.object.userData.target }; }
function focusRoom(roomKey) { const r = ROOMS[roomKey]; state.cameraGoal = { position: r.overview.clone(), target: r.target.clone() }; }
function focusOverview() { state.cameraGoal = { position: new THREE.Vector3(0, 3.8, 9.8), target: new THREE.Vector3(0, 1.8, -1.5) }; }
function onPointerDown(event) { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(clickable)[0]; if (hit?.object.userData.artwork) focusArtwork(state.displayed.findIndex((i) => i.object === hit.object)); }
function resize() { const { clientWidth, clientHeight } = els.mount; renderer.setSize(clientWidth, clientHeight, false); camera.aspect = clientWidth / Math.max(clientHeight, 1); camera.updateProjectionMatrix(); }
function updateLabels() { const w = els.mount.clientWidth; const h = els.mount.clientHeight; state.labels.forEach((label) => { const p = label.userData.position.clone().project(camera); label.style.left = `${(p.x * 0.5 + 0.5) * w}px`; label.style.top = `${(-p.y * 0.5 + 0.5) * h}px`; label.style.display = p.z > 1 || Math.abs(p.x) > 1.15 || Math.abs(p.y) > 1.15 ? 'none' : ''; }); }
function animate() { requestAnimationFrame(animate); if (state.cameraGoal) { camera.position.lerp(state.cameraGoal.position, 0.09); controls.target.lerp(state.cameraGoal.target, 0.09); if (camera.position.distanceTo(state.cameraGoal.position) < 0.035 && controls.target.distanceTo(state.cameraGoal.target) < 0.035) state.cameraGoal = null; } controls.update(); updateLabels(); renderer.render(scene, camera); }
async function init() { initEnvironment(); const data = await EcoData.loadSharedData(); state.topicClusters = data.topicClusters; state.artworks = data.artworkData.features.map((a) => EcoData.enrichArtwork(a, data)).filter(hasThumbnail); populateControls(); await renderRoom('continent'); focusOverview(); resize(); animate(); }

els.mode.addEventListener('change', () => renderRoom(els.mode.value));
els.topic.addEventListener('change', () => renderRoom('topic'));
els.enterContinents.addEventListener('click', () => renderRoom('continent'));
els.enterTopics.addEventListener('click', () => renderRoom('topic'));
els.enterTimeline.addEventListener('click', () => renderRoom('timeline'));
els.previous.addEventListener('click', () => focusArtwork(state.selectedIndex - 1));
els.next.addEventListener('click', () => focusArtwork(state.selectedIndex + 1));
els.overview.addEventListener('click', focusOverview);
renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', resize);
init().catch((error) => { els.info.innerHTML = `<h2 class="text-xl font-semibold">Exhibition unavailable</h2><p class="mt-2 text-sm opacity-75">${escapeHtml(error.message)}</p>`; console.error(error); });
