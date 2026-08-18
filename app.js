<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Sanal Gözlük Deneme</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #111; color: #eee; }
    .hidden { display: none !important; }
    #status {
      position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); padding: 8px 16px; border-radius: 20px;
      z-index: 100; font-size: 14px;
    }
    #video, #photo-canvas, #three-canvas {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      object-fit: contain;
    }
    #photo-canvas { display: none; }
    #controls {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 10px; z-index: 100;
    }
    button {
      background: #333; color: #fff; border: 1px solid #555;
      padding: 8px 16px; border-radius: 6px; cursor: pointer;
    }
    button:hover { background: #444; }
    #model-row {
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; flex-wrap: wrap; max-width: 90vw;
      justify-content: center; z-index: 100;
    }
    .model-btn {
      display: flex; flex-direction: column; align-items: center;
      background: #222; border: 1px solid #444; padding: 6px;
      border-radius: 8px; min-width: 80px;
    }
    .model-btn img, .model-btn .swatch {
      width: 60px; height: 40px; object-fit: contain;
      background: #333; border-radius: 4px; margin-bottom: 4px;
    }
    .model-btn.active { border-color: #fbbf24; }
    #buy-link {
      position: fixed; top: 60px; right: 20px;
      background: #fbbf24; color: #111; padding: 10px 20px;
      border-radius: 8px; text-decoration: none; font-weight: bold;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div id="status" class="hidden"></div>
  <video id="video" autoplay playsinline></video>
  <canvas id="photo-canvas"></canvas>
  <canvas id="three-canvas"></canvas>
  
  <a id="buy-link" href="#" target="_blank" class="hidden">Satın Al</a>
  
  <div id="model-row"></div>
  
  <div id="controls">
    <button id="snap-btn">📸 Fotoğraf Çek</button>
    <button id="upload-btn">📁 Fotoğraf Yükle</button>
    <button id="camera-btn" style="display:none;">📷 Kameraya Dön</button>
    <input id="file-input" type="file" accept="image/*" style="display:none;" />
  </div>

  <script type="module">
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
    const buyLink = document.getElementById("buy-link");

    function setStatus(msg) {
      if (!msg) { statusEl.classList.add("hidden"); return; }
      statusEl.classList.remove("hidden");
      statusEl.textContent = msg;
    }

    // ---------- Glasses catalog ----------
    const STORE = "https://www.hkboptik.com/urun/";
    const CATALOG = [
      { name: "Ray-Ban RB 3447", img: "urunler/rayban-rb3447.png",
        url: STORE + "ray-ban-rb-3447-029-53-51-145-3n-unisex-gunes-gozlugu",
        shape: "round", metal: true, frame: 0x5a5f66, lens: 0x2f4a34, lensOpacity: 0.85,
        lensW: 3.1, lensH: 3.0 },
      { name: "Vogue VO 5440-S", img: "urunler/vogue-vo5440s.png",
        url: STORE + "vogue-vo-5440-s-300580-52-17-135-3n-kadin-gunes-gozlugu",
        shape: "rect", frame: 0x1e3a4a, lens: 0x1a2a5a, lensOpacity: 0.8,
        lensW: 3.4, lensH: 2.4 },
      { name: "Vogue VO 4204-SI", img: "urunler/vogue-vo4204si.png",
        url: STORE + "vogue-vo4204-si-280-11-56-18-140-2n-kadin-gunes-gozlugu",
        shape: "rect", metal: true, doubleBridge: true, frame: 0xc9a227, lens: 0x5a6068, lensOpacity: 0.55,
        lensW: 3.4, lensH: 3.0 },
      { name: "Vogue VO 5435-SI", img: "urunler/vogue-vo5435si.png",
        url: STORE + "vogue-vo5435-si-w65613-55-17-140-3n-kadin-gunes-gozlugu",
        shape: "cat", frame: 0x5a3a1e, lens: 0x6b4423, lensOpacity: 0.6,
        lensW: 3.5, lensH: 2.8 },
      { name: "R. Cavalli 1102H-S", img: "urunler/cavalli-1102hs.png",
        url: STORE + "roberto-cavalli-1102h-s-01b-54-22-140-kadin-gunes-gozlugu",
        shape: "oval", frame: 0x141414, lens: 0x5a6068, lensOpacity: 0.6,
        lensW: 3.3, lensH: 2.2 },
      { name: "R. Cavalli RC 1134", img: "urunler/cavalli-rc1134.png",
        url: STORE + "roberto-cavalli-rc-1134-01a-55-17-145-erkek-gunes-gozlugu",
        shape: "rect", frame: 0x111111, lens: 0x2a2d31, lensOpacity: 0.8,
        lensW: 3.5, lensH: 2.8 },
      { name: "Superstep 901", img: "urunler/superstep-901.png",
        url: STORE + "superstep-901-51-18-136-05-3n-unisex-gunes-gozlugu",
        shape: "round", metal: true, frame: 0xc9a227, lens: 0x4a2410, lensOpacity: 0.8,
        lensW: 3.3, lensH: 3.2 },
      { name: "Tomy Marin TM 2017", img: "urunler/tomymarin-tm2017.png",
        url: STORE + "tomy-marin-tm-2017-52-12-140-01m-unisex-gunes-gozlugu",
        shape: "rect", frame: 0xf2f0ec, lens: 0x26262b, lensOpacity: 0.85,
        lensW: 3.2, lensH: 1.6 },
      { name: "U.S. Polo Assn. 0138", img: "urunler/uspolo-0138.png",
        url: STORE + "u-s-polo-assn-0138-50-18-144-02-unisex-gunes-gozlugu",
        shape: "round", metal: true, frame: 0xd4b04a, lens: 0x3a4f34, lensOpacity: 0.8,
        lensW: 3.1, lensH: 3.0 },
      { name: "Osse 2676", img: "urunler/osse-2676.png",
        url: STORE + "osse-2676-59-16-147-02-kadin-gunes-gozlugu",
        shape: "oval", metal: true, doubleBridge: true, frame: 0xc0c4c8, lens: 0xbcd6b0, lensOpacity: 0.5,
        lensW: 3.4, lensH: 2.5 },
      { name: "Vogue VO 4199-S", img: "urunler/vogue-vo4199s.png",
        url: STORE + "vogue-vo-4199-s-848-6k-58-16-140-2n-kadin-gunes-gozlugu",
        shape: "rect", metal: true, frame: 0xd4b04a, lens: 0x6b4a1e, lensOpacity: 0.6,
        lensW: 3.9, lensH: 3.3 },
    ];

    // ---------- Three.js scene ----------
    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
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

    function ovalShape(w, h) {
      const s = new THREE.Shape();
      s.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2);
      return s;
    }

    function catEyeShape(w, h) {
      const s = new THREE.Shape();
      const x = -w / 2, y = -h / 2, r = 0.5;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r - 0.2, y);
      s.quadraticCurveTo(x + w, y, x + w, y + h * 0.45);
      s.lineTo(x + w + 0.12, y + h - 0.45);
      s.quadraticCurveTo(x + w + 0.2, y + h + 0.12, x + w - 0.5, y + h + 0.05);
      s.quadraticCurveTo(x + w * 0.45, y + h - 0.12, x + 0.3, y + h - 0.2);
      s.quadraticCurveTo(x, y + h - 0.25, x, y + h - 0.7);
      s.lineTo(x, y + r);
      s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }

    function lensOutline(shape, w, h) {
      if (shape === "oval") return ovalShape(w, h);
      if (shape === "cat") return catEyeShape(w, h);
      const cornerR = shape === "round" ? Math.min(w, h) * 0.48 : Math.min(0.55, h * 0.3);
      return roundedRectShape(w, h, cornerR);
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

    function buildGlasses({ frame, lens, lensOpacity, shape, metal, doubleBridge, lensW = 3.4, lensH = 2.7 }) {
      const g = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({
        color: frame,
        roughness: metal ? 0.25 : 0.35,
        metalness: metal ? 0.85 : 0.45,
        side: THREE.DoubleSide,
      });
      const lensMat = new THREE.MeshPhysicalMaterial({
        color: lens, transparent: true, opacity: lensOpacity,
        roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide,
      });

      const rimT = metal ? 0.12 : 0.24;
      const eyeY = 2.45, eyeZ = 4.5;
      const eyeX = 3.15;

      for (const side of [-1, 1]) {
        const outer = lensOutline(shape, lensW, lensH);
        outer.holes.push(lensOutline(shape, lensW - rimT * 2, lensH - rimT * 2));
        const rimGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.28, bevelEnabled: false });
        const rim = new THREE.Mesh(rimGeo, frameMat);
        rim.position.set(side * eyeX, eyeY, eyeZ);
        rim.scale.x = side;
        g.add(rim);

        const lensGeo = new THREE.ShapeGeometry(lensOutline(shape, lensW - rimT, lensH - rimT));
        const lensMesh = new THREE.Mesh(lensGeo, lensMat);
        lensMesh.position.set(side * eyeX, eyeY, eyeZ + 0.14);
        lensMesh.scale.x = side;
        g.add(lensMesh);

        const hinge = new THREE.Vector3(side * (eyeX + lensW / 2), eyeY + 0.3, eyeZ);
        const ear = new THREE.Vector3(side * 7.4, 2.5, -2.2);
        g.add(tubeBetween(hinge, ear, metal ? 0.09 : 0.13, frameMat));
      }

      const bridgeR = metal ? 0.1 : 0.16;
      const bridgeA = new THREE.Vector3(-(eyeX - lensW / 2) - 0.05, eyeY + 0.55, eyeZ + 0.1);
      const bridgeB = new THREE.Vector3((eyeX - lensW / 2) + 0.05, eyeY + 0.55, eyeZ + 0.1);
      g.add(tubeBetween(bridgeA, bridgeB, bridgeR, frameMat));
      if (doubleBridge) {
        const topY = eyeY + lensH / 2 - 0.1;
        const a = new THREE.Vector3(-(eyeX - lensW / 2) - 0.3, topY, eyeZ + 0.1);
        const b = new THREE.Vector3((eyeX - lensW / 2) + 0.3, topY, eyeZ + 0.1);
        g.add(tubeBetween(a, b, bridgeR, frameMat));
      }

      return g;
    }

    let currentGlasses = null;
    function selectModel(idx) {
      if (currentGlasses) faceGroup.remove(currentGlasses);
      currentGlasses = buildGlasses(CATALOG[idx]);
      faceGroup.add(currentGlasses);
      [...modelRow.children].forEach((b, i) => b.classList.toggle("active", i === idx));
      if (buyLink) {
        if (CATALOG[idx].url) {
          buyLink.href = CATALOG[idx].url;
          buyLink.style.display = "";
        } else {
          buyLink.style.display = "none";
        }
      }
    }

    CATALOG.forEach((m, i) => {
      const btn = document.createElement("button");
      btn.className = "model-btn";
      if (m.img) {
        const im = document.createElement("img");
        im.className = "product-thumb";
        im.src = m.img;
        im.alt = m.name;
        im.loading = "lazy";
        btn.append(im);
      } else {
        const sw = document.createElement("div");
        sw.className = "swatch";
        sw.style.background = "#" + m.frame.toString(16).padStart(6, "0");
        btn.append(sw);
      }
      btn.append(document.createTextNode(m.name));
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
    const ANCHOR = new THREE.Vector3(0, 3.271027, 5.236015);
    const tmpAnchor = new THREE.Vector3();

    function applyFaceMatrix(data, landmarks) {
      targetMatrix.fromArray(data);
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
        const a = 0.5;
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
    let mode = "camera";
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
        if (video.readyState < 1) {
          await new Promise((res) => (video.onloadedmetadata = res));
        }
        await video.play();
        resize(video.videoWidth, video.videoHeight);
        if (landmarker.runningMode !== "VIDEO") await landmarker.setOptions({ runningMode: "VIDEO" });
        setStatus(null);
      } catch (err) {
        console.error(err);
        setStatus("Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin veya "Fotoğrafla Dene" seçeneğini kullanın.");
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
  </script>
</body>
</html>
