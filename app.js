import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// ---------- DOM ----------
const video = document.getElementById("video");
const photoCanvas = document.getElementById("photo-canvas");
const threeCanvas = document.getElementById("three-canvas");
const statusEl = document.getElementById("status");
const modelRow = document.getElementById("model-row");
const snapBtn = document.getElementById("snap-btn");
const uploadBtn = document.getElementById("upload-btn");
const cameraBtn = document.getElementById("camera-btn");
const fileInput = document.getElementById("file-input");

function setStatus(msg) {
  if (!msg) { statusEl.classList.add("hidden"); return; }
  statusEl.classList.remove("hidden");
  statusEl.textContent = msg;
}

// ---------- Glasses catalog ----------
// All dimensions are in centimeters, in MediaPipe's canonical face space:
// eye centers ≈ (±3.15, 2.6, 3.5), nose bridge ≈ (0, 3.0, 5.2), ears ≈ (±7.7, 2.4, -2.0)
const CATALOG = [
  { name: "Klasik Siyah",  frame: 0x1a1a1a, lens: 0x88aacc, lensOpacity: 0.12, shape: "rect" },
  { name: "Kahve Tonu",    frame: 0x6b3f1d, lens: 0x88aacc, lensOpacity: 0.12, shape: "round" },
  { name: "Altın Çerçeve", frame: 0xc9a227, lens: 0x88aacc, lensOpacity: 0.10, shape: "round" },
  { name: "Güneş - Siyah", frame: 0x111111, lens: 0x101418, lensOpacity: 0.82, shape: "rect" },
  { name: "Güneş - Kahve", frame: 0x4a2c12, lens: 0x3a2410, lensOpacity: 0.75, shape: "round" },
  { name: "Kırmızı",       frame: 0xa81d2b, lens: 0x88aacc, lensOpacity: 0.12, shape: "rect" },
];

// ---------- Three.js scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
// MediaPipe face geometry assumes a perspective camera with ~63° vertical FOV.
const camera = new THREE.PerspectiveCamera(63, 4 / 3, 1, 10000);

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.4);
dir.position.set(0, 30, 100);
scene.add(dir);

const faceGroup = new THREE.Group();
faceGroup.matrixAutoUpdate = false;
faceGroup.visible = false;
scene.add(faceGroup);

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function tubeBetween(a, b, radius, material) {
  const dirV = new THREE.Vector3().subVectors(b, a);
  const len = dirV.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 12);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirV.normalize());
  return mesh;
}

function buildGlasses({ frame, lens, lensOpacity, shape }) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: frame, roughness: 0.35, metalness: 0.45 });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: lens, transparent: true, opacity: lensOpacity,
    roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide,
  });

  const lensW = 3.4, lensH = 2.7;
  const rimT = 0.22;           // rim thickness
  const eyeY = 2.45, eyeZ = 4.5;
  const eyeX = 3.15;
  const cornerR = shape === "round" ? Math.min(lensW, lensH) * 0.48 : 0.55;

  for (const side of [-1, 1]) {
    // Rim: outer rounded rect with inner hole, extruded
    const outer = roundedRectShape(lensW, lensH, cornerR);
    const hole = roundedRectShape(lensW - rimT * 2, lensH - rimT * 2, Math.max(cornerR - rimT, 0.1));
    outer.holes.push(hole);
    const rimGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.28, bevelEnabled: false });
    const rim = new THREE.Mesh(rimGeo, frameMat);
    rim.position.set(side * eyeX, eyeY, eyeZ);
    g.add(rim);

    // Lens
    const lensGeo = new THREE.ShapeGeometry(roundedRectShape(lensW - rimT, lensH - rimT, Math.max(cornerR - rimT / 2, 0.1)));
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.set(side * eyeX, eyeY, eyeZ + 0.14);
    g.add(lensMesh);

    // Temple (sap): from hinge to ear
    const hinge = new THREE.Vector3(side * (eyeX + lensW / 2), eyeY + 0.3, eyeZ);
    const ear = new THREE.Vector3(side * 7.4, 2.5, -2.2);
    g.add(tubeBetween(hinge, ear, 0.13, frameMat));
  }

  // Bridge (burun köprüsü)
  const bridgeA = new THREE.Vector3(-(eyeX - lensW / 2) - 0.05, eyeY + 0.55, eyeZ + 0.1);
  const bridgeB = new THREE.Vector3((eyeX - lensW / 2) + 0.05, eyeY + 0.55, eyeZ + 0.1);
  g.add(tubeBetween(bridgeA, bridgeB, 0.16, frameMat));

  return g;
}

let currentGlasses = null;
function selectModel(idx) {
  if (currentGlasses) faceGroup.remove(currentGlasses);
  currentGlasses = buildGlasses(CATALOG[idx]);
  faceGroup.add(currentGlasses);
  [...modelRow.children].forEach((b, i) => b.classList.toggle("active", i === idx));
}

CATALOG.forEach((m, i) => {
  const btn = document.createElement("button");
  btn.className = "model-btn";
  const sw = document.createElement("div");
  sw.className = "swatch";
  sw.style.background = "#" + m.frame.toString(16).padStart(6, "0");
  btn.append(sw, document.createTextNode(m.name));
  btn.addEventListener("click", () => selectModel(i));
  modelRow.appendChild(btn);
});
selectModel(0);

// ---------- MediaPipe FaceLandmarker ----------
let landmarker = null;
async function loadLandmarker() {
  setStatus("Yüz takip modeli yükleniyor…");
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    outputFacialTransformationMatrixes: true,
    runningMode: "VIDEO",
    numFaces: 1,
  });
}

// ---------- Matrix smoothing ----------
const targetMatrix = new THREE.Matrix4();
const smoothPos = new THREE.Vector3();
const smoothQuat = new THREE.Quaternion();
const smoothScale = new THREE.Vector3(1, 1, 1);
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
let hasPose = false;
const ANCHOR = new THREE.Vector3(0, 3.271027, 5.236015); // canonical landmark 168 (nose bridge)
const tmpAnchor = new THREE.Vector3();

function applyFaceMatrix(data, landmarks) {
  targetMatrix.fromArray(data);
  // Correct translation so the projected anchor lands exactly on the detected
  // 2D nose-bridge landmark (fixes offsets from camera-FOV mismatch).
  if (landmarks) {
    const lm = landmarks[168];
    tmpAnchor.copy(ANCHOR).applyMatrix4(targetMatrix);
    const dist = -tmpAnchor.z;
    if (dist > 0) {
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const ndcX = lm.x * 2 - 1;
      const ndcY = -(lm.y * 2 - 1);
      const wantX = ndcX * dist * tanV * camera.aspect;
      const wantY = ndcY * dist * tanV;
      const e = targetMatrix.elements;
      e[12] += wantX - tmpAnchor.x;
      e[13] += wantY - tmpAnchor.y;
    }
  }
  targetMatrix.decompose(tmpPos, tmpQuat, tmpScale);
  if (!hasPose) {
    smoothPos.copy(tmpPos); smoothQuat.copy(tmpQuat); smoothScale.copy(tmpScale);
    hasPose = true;
  } else {
    const a = 0.5; // smoothing factor
    smoothPos.lerp(tmpPos, a);
    smoothQuat.slerp(tmpQuat, a);
    smoothScale.lerp(tmpScale, a);
  }
  faceGroup.matrix.compose(smoothPos, smoothQuat, smoothScale);
  faceGroup.visible = true;
}

// ---------- Sizing ----------
function resize(w, h) {
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ---------- Camera mode ----------
let mode = "camera"; // "camera" | "photo"
let stream = null;
let lastVideoTime = -1;

async function startCamera() {
  mode = "camera";
  hasPose = false;
  photoCanvas.style.display = "none";
  video.style.display = "";
  cameraBtn.style.display = "none";
  try {
    setStatus("Kamera açılıyor… (izin vermeniz gerekebilir)");
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise((res) => (video.onloadedmetadata = res));
    await video.play();
    resize(video.videoWidth, video.videoHeight);
    if (landmarker.runningMode !== "VIDEO") await landmarker.setOptions({ runningMode: "VIDEO" });
    setStatus(null);
  } catch (err) {
    console.error(err);
    setStatus("Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin veya \"Fotoğrafla Dene\" seçeneğini kullanın.");
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  video.srcObject = null;
}

async function usePhoto(img) {
  mode = "photo";
  hasPose = false;
  stopCamera();
  video.style.display = "none";
  photoCanvas.style.display = "";
  cameraBtn.style.display = "";
  const ctx = photoCanvas.getContext("2d");
  photoCanvas.width = img.naturalWidth;
  photoCanvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  resize(img.naturalWidth, img.naturalHeight);
  if (landmarker.runningMode !== "IMAGE") await landmarker.setOptions({ runningMode: "IMAGE" });
  const res = landmarker.detect(photoCanvas);
  if (res.facialTransformationMatrixes?.length) {
    applyFaceMatrix(res.facialTransformationMatrixes[0].data, res.faceLandmarks?.[0]);
    setStatus(null);
  } else {
    faceGroup.visible = false;
    setStatus("Bu fotoğrafta yüz bulunamadı. Lütfen yüzün net göründüğü bir fotoğraf seçin.");
  }
  renderer.render(scene, camera);
}

// ---------- Render loop ----------
function tick() {
  requestAnimationFrame(tick);
  if (mode === "camera" && landmarker && video.readyState >= 2) {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const res = landmarker.detectForVideo(video, performance.now());
      if (res.facialTransformationMatrixes?.length) {
        applyFaceMatrix(res.facialTransformationMatrixes[0].data, res.faceLandmarks?.[0]);
      } else {
        faceGroup.visible = false;
      }
    }
  }
  renderer.render(scene, camera);
}

// ---------- Snapshot ----------
snapBtn.addEventListener("click", () => {
  const w = threeCanvas.width, h = threeCanvas.height;
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const ctx = out.getContext("2d");
  // mirror to match what the user sees
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  if (mode === "camera") ctx.drawImage(video, 0, 0, w, h);
  else ctx.drawImage(photoCanvas, 0, 0, w, h);
  renderer.render(scene, camera);
  ctx.drawImage(threeCanvas, 0, 0, w, h);
  const a = document.createElement("a");
  a.download = "gozluk-deneme.png";
  a.href = out.toDataURL("image/png");
  a.click();
});

uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => usePhoto(img);
  img.src = URL.createObjectURL(file);
});
cameraBtn.addEventListener("click", startCamera);

// Re-apply pose when switching models in photo mode
modelRow.addEventListener("click", () => {
  if (mode === "photo") renderer.render(scene, camera);
});

// ---------- Init ----------
(async () => {
  try {
    await loadLandmarker();
    await startCamera();
    tick();
  } catch (err) {
    console.error(err);
    setStatus("Bir hata oluştu: " + err.message);
  }
})();
