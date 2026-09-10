import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { TurntableState } from './turntable-state.js';

const MODEL_URL = new URL('./models/yoshiko.vrm', import.meta.url).href;
const MAX_PIXEL_RATIO = 2;
const HORIZONTAL_GESTURE_THRESHOLD = 7;

const DEFAULT_STANDING_POSE = [
  ['leftShoulder', 0, 0, 0],
  ['rightShoulder', 0, 0, 0],
  ['leftUpperArm', -6, 0, 55],
  ['rightUpperArm', -6, 0, -55],
  ['leftLowerArm', 0, -14, -13],
  ['rightLowerArm', 0, 14, 13],
  ['leftHand', 0, 0, 0],
  ['rightHand', 0, 0, 0],
];

const viewer = document.querySelector('#vrm-viewer');
const canvas = document.querySelector('#vrm-canvas');
const status = document.querySelector('#vrm-status');
const fallback = document.querySelector('#vrm-fallback');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const turntable = new TurntableState({ reducedMotion: reducedMotion.matches });

let renderer;
let scene;
let camera;
let turntableRoot;
let currentVrm;
let modelSize = new THREE.Vector3(1, 2, 1);
let animationFrame;
let previousFrameTime = performance.now();
let activePointerId = null;
let gestureStartX = 0;
let gestureStartY = 0;
let gestureDirection = 'pending';

function degrees(value) {
  return THREE.MathUtils.degToRad(value);
}

function applyDefaultStandingPose(vrm) {
  for (const [boneName, x, y, z] of DEFAULT_STANDING_POSE) {
    const bone = vrm.humanoid?.getNormalizedBoneNode(boneName);
    if (!bone) continue;
    const offset = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(degrees(x), degrees(y), degrees(z), 'XYZ'),
    );
    bone.quaternion.multiply(offset);
  }
}

function centerModel(model) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());

  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);
  modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
}

function frameModel() {
  const targetY = Math.max(0.5, modelSize.y * 0.5);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const verticalDistance = modelSize.y / (2 * Math.tan(verticalFov / 2));
  const horizontalSize = Math.max(modelSize.x, modelSize.z);
  const horizontalDistance = horizontalSize / (2 * Math.tan(horizontalFov / 2));
  const distance = Math.max(verticalDistance * 1.08, horizontalDistance * 1.22, 1.8);

  camera.position.set(0, targetY, distance);
  camera.lookAt(0, targetY, 0);
  camera.updateProjectionMatrix();
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const width = Math.max(1, viewer.clientWidth);
  const height = Math.max(1, viewer.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (currentVrm) frameModel();
}

function showFallback() {
  window.clearTimeout(window.__yoshikoVrmFallbackTimer);
  status.textContent = '3Dを読み込めなかったよ';
  fallback.hidden = false;
  canvas.hidden = true;
}

function render(now) {
  const deltaSeconds = Math.min((now - previousFrameTime) / 1000, 0.1);
  previousFrameTime = now;
  if (turntableRoot) turntableRoot.rotation.y = turntable.step(deltaSeconds, now);
  if (currentVrm) currentVrm.update(deltaSeconds);
  renderer.render(scene, camera);
  animationFrame = requestAnimationFrame(render);
}

function onPointerDown(event) {
  if (activePointerId !== null) return;
  activePointerId = event.pointerId;
  gestureStartX = event.clientX;
  gestureStartY = event.clientY;
  gestureDirection = event.pointerType === 'mouse' ? 'horizontal' : 'pending';
  turntable.beginDrag(event.clientX, performance.now());
  canvas.classList.add('is-dragging');
  if (gestureDirection === 'horizontal') canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (event.pointerId !== activePointerId) return;
  if (gestureDirection === 'pending') {
    const deltaX = event.clientX - gestureStartX;
    const deltaY = event.clientY - gestureStartY;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < HORIZONTAL_GESTURE_THRESHOLD) return;
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      gestureDirection = 'vertical';
      turntable.endDrag(performance.now());
      canvas.classList.remove('is-dragging');
      return;
    }
    gestureDirection = 'horizontal';
    turntable.lastPointerX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  }
  if (gestureDirection === 'horizontal') turntable.dragTo(event.clientX, performance.now());
}

function finishPointer(event) {
  if (event.pointerId !== activePointerId) return;
  turntable.endDrag(performance.now());
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  canvas.classList.remove('is-dragging');
  activePointerId = null;
  gestureDirection = 'pending';
}

async function initializeViewer() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    turntableRoot = new THREE.Group();
    scene.add(turntableRoot);
    scene.add(new THREE.HemisphereLight(0xfffbef, 0x8fa58d, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(1.8, 3.2, 3.8);
    scene.add(keyLight);

    resizeRenderer();
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(MODEL_URL);
    currentVrm = gltf.userData.vrm;
    if (!currentVrm) throw new Error('VRMデータが見つかりません');

    VRMUtils.removeUnnecessaryVertices(currentVrm.scene);
    VRMUtils.combineSkeletons(currentVrm.scene);
    VRMUtils.rotateVRM0(currentVrm);
    applyDefaultStandingPose(currentVrm);
    turntableRoot.add(currentVrm.scene);
    centerModel(currentVrm.scene);
    frameModel();
    window.clearTimeout(window.__yoshikoVrmFallbackTimer);
    status.hidden = true;
    animationFrame = requestAnimationFrame(render);
  } catch (error) {
    console.error('Yoshiko VRM load failed:', error);
    showFallback();
  }
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
new ResizeObserver(resizeRenderer).observe(viewer);
reducedMotion.addEventListener('change', (event) => {
  turntable.autoRotateEnabled = !event.matches;
});
window.addEventListener('pagehide', () => cancelAnimationFrame(animationFrame), { once: true });

requestAnimationFrame(initializeViewer);
