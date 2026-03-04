import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.162.0/examples/jsm/controls/OrbitControls.js";

const canvas = document.getElementById("bgCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableRotate = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;

const radius = 3;
const pointCount = window.innerWidth > 900 ? 720 : 420;

// Generate evenly distributed points on a sphere (Fibonacci sphere)
function generatePoints(count, r) {
  const positions = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;
    positions.push(x * r, y * r, z * r);
  }
  return new Float32Array(positions);
}

const pointPositions = generatePoints(pointCount, radius);

const pointsGeo = new THREE.BufferGeometry();
pointsGeo.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));

const pointsMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.035,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.95,
});
const points = new THREE.Points(pointsGeo, pointsMat);

// Halo for subtle glow
const haloMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.09,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.12,
  blending: THREE.AdditiveBlending,
});
const halo = new THREE.Points(pointsGeo.clone(), haloMat);

// Build line segments between nearby points
function buildLines(positions, threshold = 0.55, maxPerPoint = 5) {
  const verts = [];
  const len = positions.length / 3;
  for (let i = 0; i < len; i += 1) {
    const ix = positions[i * 3];
    const iy = positions[i * 3 + 1];
    const iz = positions[i * 3 + 2];
    let connections = 0;
    for (let j = i + 1; j < len; j += 1) {
      if (connections >= maxPerPoint) break;
      const jx = positions[j * 3];
      const jy = positions[j * 3 + 1];
      const jz = positions[j * 3 + 2];
      const dx = ix - jx;
      const dy = iy - jy;
      const dz = iz - jz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < threshold) {
        verts.push(ix, iy, iz, jx, jy, jz);
        connections += 1;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  return geo;
}

const lineGeo = buildLines(pointPositions, 0.7, 4);
const lineMat = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.22,
  linewidth: 1,
});
const lines = new THREE.LineSegments(lineGeo, lineMat);

const group = new THREE.Group();
group.add(points);
group.add(halo);
group.add(lines);
scene.add(group);

let desiredX = 0;
let desiredY = 0;
let smoothX = 0;
let smoothY = 0;
let autoY = 0;

function handlePointer(x, y) {
  const nx = (x / window.innerWidth) - 0.5;
  const ny = (y / window.innerHeight) - 0.5;
  desiredY = nx * 1.4; // yaw
  desiredX = ny * 1.0; // pitch
}

window.addEventListener("mousemove", (e) => handlePointer(e.clientX, e.clientY), { passive: true });
window.addEventListener("touchmove", (e) => {
  if (!e.touches.length) return;
  const t = e.touches[0];
  handlePointer(t.clientX, t.clientY);
}, { passive: true });

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", onResize);

function animate() {
  requestAnimationFrame(animate);

  smoothX += (desiredX - smoothX) * 0.06;
  smoothY += (desiredY - smoothY) * 0.06;
  autoY += 0.0035; // idle spin

  group.rotation.x = smoothX;
  group.rotation.y = autoY + smoothY;

  controls.update();
  renderer.render(scene, camera);
}

animate();
