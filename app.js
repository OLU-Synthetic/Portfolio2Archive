// WORKS INDEX — brutal slab + optional media + PiP trace (face/body) controlling fidelity.

const WORKS = [
  // Add optional fields:
  // poster: "assets/posters/name.jpg"
  // date, medium, duration, role
  { title: "Skull_Dyptych", file: "works/skull_dyptych.html", desc: "delayed self / degraded copy", date:"2026", medium:"WEB", duration:"LOOP", poster:"assets/posters/skull_dyptych.jpg" },
  { title: "LATENCY_MIRROR", file: "works/latency_mirror.html", desc: "delayed self / degraded copy", date:"2026", medium:"WEB/CAMERA", duration:"REALTIME" },
  { title: "PANOPTICON_PROTOCOL", file: "works/panopticon_protocol.html", desc: "institutional rite / surveillance logic", date:"2026", medium:"WEB/3D", duration:"RUNTIME" },
  { title: "COLOUR_STUDY_OKLCH", file: "works/colour_study.html", desc: "formal spine / optical pressure", date:"2026", medium:"WEB/GENERATIVE", duration:"LOOP" },
];

const $ = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[m]);
}

function say(msg){
  const status = $("#pipStatus");
  if(!status) return;
  status.textContent = msg;
  status.classList.add("on");
  clearTimeout(say._t);
  say._t = setTimeout(() => status.classList.remove("on"), 2000);
}

/* ---------- WORKS RENDER ---------- */

function renderWorks() {
  const ul = $("#works");
  if (!ul) return;
  ul.innerHTML = "";

  for (const w of WORKS) {
    const li = document.createElement("li");
    li.className = "work";

    // Optional poster (auto-remove if missing)
    if (w.poster) {
      const media = document.createElement("div");
      media.className = "media";

      const img = document.createElement("img");
      img.src = `./${w.poster}`;
      img.alt = `${w.title} poster`;
      img.loading = "lazy";
      img.onerror = () => media.remove(); // hide formatting if poster is missing

      media.appendChild(img);
      li.appendChild(media);
    }

    const a = document.createElement("a");
    a.href = `./${w.file}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `${escapeHtml(w.title)} <span class="arrow">↗</span>`;
    li.appendChild(a);

    if (w.desc && w.desc.trim()) {
      const d = document.createElement("div");
      d.className = "desc";
      d.textContent = w.desc;
      li.appendChild(d);
    }

    // Optional tags
    const tags = [];
    if (w.date) tags.push(w.date);
    if (w.medium) tags.push(w.medium);
    if (w.duration) tags.push(w.duration);
    if (w.role) tags.push(w.role);

    if (tags.length) {
      const meta = document.createElement("div");
      meta.className = "meta";
      for (const t of tags) {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        meta.appendChild(span);
      }
      li.appendChild(meta);
    }

    ul.appendChild(li);
  }
}

function addMicroInteractions() {
  const ul = $("#works");
  if (!ul) return;

  ul.addEventListener("mouseover", (e) => {
    const a = e.target.closest("a");
    if (a) a.classList.add("hot");
  });
  ul.addEventListener("mouseout", (e) => {
    const a = e.target.closest("a");
    if (a) a.classList.remove("hot");
  });
}

/* ---------- PiP FOLLOW ---------- */

function pipFollow() {
  const frame = $("#pipFrame");
  if (!frame) return;

  let y = 0, target = 0;
  function updateTarget(){ target = (window.scrollY || 0) * 0.08; }
  function tick(){
    y += (target - y) * 0.085;
    frame.style.transform = `translate3d(0, ${y}px, 0)`;
    requestAnimationFrame(tick);
  }
  window.addEventListener("scroll", updateTarget, { passive:true });
  updateTarget();
  tick();
}

/* ---------- PiP CAMERA + TRACE ---------- */

let camOn = false;
let stream = null;

let traceMode = "BODY"; // BODY | FACE
let fidelity = 0;       // 0..1

// MediaPipe trackers (lazy)
let mp = null; // { FaceLandmarker, PoseLandmarker, FilesetResolver, face, pose }
let trackerReady = false;

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

async function loadMediapipe(){
  if(trackerReady) return true;
  trackerReady = true;

  try{
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
    const { FilesetResolver, FaceLandmarker, PoseLandmarker } = vision;

    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const face = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
      },
      runningMode: "VIDEO",
      numFaces: 1
    });

    const pose = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
      },
      runningMode: "VIDEO",
      numPoses: 1
    });

    mp = { face, pose };
    return true;
  }catch(e){
    console.warn("[PiP] MediaPipe failed:", e);
    mp = null;
    return false;
  }
}

function stopCamera(){
  const video = $("#pipVideo");
  const gate = $("#pipGate");
  const modeBtn = $("#pipMode");

  if(stream){
    for(const t of stream.getTracks()) t.stop();
    stream = null;
  }
  if(video){
    video.srcObject = null;
  }
  camOn = false;
  fidelity = 0;

  if(gate){
    gate.disabled = false;
    gate.textContent = "ENABLE CAM ↗";
  }
  if(modeBtn){
    modeBtn.style.display = "none";
  }
  say("INPUT CLOSED.");
}

async function toggleCamera(){
  if(camOn){
    stopCamera();
    return;
  }

  const video = $("#pipVideo");
  const gate = $("#pipGate");
  const modeBtn = $("#pipMode");

  if(!video || !gate) return;

  if(!window.isSecureContext){
    say("DENIED: HTTPS REQUIRED.");
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    say("DENIED: CAMERA API UNAVAILABLE.");
    return;
  }

  gate.disabled = true;
  gate.textContent = "REQUESTING…";
  say("REQUESTING PERMISSION…");

  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode:"user", width:{ideal:640}, height:{ideal:640} },
      audio: false
    });
    video.srcObject = stream;
    await video.play().catch(()=>{});
    camOn = true;

    gate.disabled = false;
    gate.textContent = "DISABLE CAM ↗";
    if(modeBtn){
      modeBtn.style.display = "block";
      modeBtn.textContent = `MODE: ${traceMode}`;
    }

    say("INPUT ACCEPTED.");

    // lazy-load trackers (optional). If it fails, we still run degraded feed.
    loadMediapipe().then((ok) => {
      if(ok) say(`TRACE ONLINE: ${traceMode}.`);
      else   say("TRACE OFFLINE.");
    });

  }catch(err){
    gate.disabled = false;
    gate.textContent = "ENABLE CAM ↗";
    say(`DENIED: ${err?.name || "ERROR"}.`);
    console.error(err);
  }
}

function toggleMode(){
  traceMode = (traceMode === "BODY") ? "FACE" : "BODY";
  const modeBtn = $("#pipMode");
  if(modeBtn) modeBtn.textContent = `MODE: ${traceMode}`;
  // don’t lie: if mediapipe isn't loaded, mode does nothing visually
  say(`MODE SET: ${traceMode}.`);
}

/* --- drawing / degradation --- */

const PIP = {
  off: null,
  offCtx: null,
  lastTs: 0
};

function ensureOffscreen(){
  if(PIP.off) return;
  PIP.off = document.createElement("canvas");
  PIP.offCtx = PIP.off.getContext("2d", { willReadFrequently:false });
}

function drawPixelated(ctx, srcVideo, w, h, clarity){
  // clarity 0..1. Low clarity => heavy pixelation.
  ensureOffscreen();

  const minScale = 0.12;         // brutal
  const maxScale = 1.0;          // clean
  const s = minScale + (maxScale - minScale) * (clarity*clarity);

  const sw = Math.max(2, Math.floor(w * s));
  const sh = Math.max(2, Math.floor(h * s));

  PIP.off.width = sw; PIP.off.height = sh;

  // cover-fit into offscreen
  const vw = srcVideo.videoWidth || 1;
  const vh = srcVideo.videoHeight || 1;
  const scale = Math.max(sw / vw, sh / vh);
  const dw = vw * scale, dh = vh * scale;
  const dx = (sw - dw) / 2;
  const dy = (sh - dh) / 2;

  PIP.offCtx.imageSmoothingEnabled = true;
  PIP.offCtx.drawImage(srcVideo, dx, dy, dw, dh);

  // draw upscaled
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(PIP.off, 0, 0, w, h);

  // quantize + scanline overlay (fade with clarity)
  const q = Math.floor(28 - clarity * 24); // 28 levels -> 4 levels
  ctx.globalAlpha = 0.18 * (1 - clarity);
  for(let y=0; y<h; y+=3) ctx.fillRect(0,y,w,1);
  ctx.globalAlpha = 1;

  // slight vignette
  const g = ctx.createRadialGradient(w*0.5,h*0.5, Math.min(w,h)*0.1, w*0.5,h*0.5, Math.max(w,h)*0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${(0.60 - clarity*0.35).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // restore fillStyle for scanline next frame
  ctx.fillStyle = "#fff";
}

function drawFaceOverlay(ctx, landmarks, w, h){
  ctx.strokeStyle = "rgba(120,255,255,0.30)";
  ctx.lineWidth = 1;

  // draw a crude hull: bounding box of landmarks (cheap but effective)
  let minx=1e9, miny=1e9, maxx=-1e9, maxy=-1e9;
  for(const p of landmarks){
    const x = p.x*w, y = p.y*h;
    if(x<minx) minx=x; if(y<miny) miny=y;
    if(x>maxx) maxx=x; if(y>maxy) maxy=y;
  }
  const bw = maxx-minx, bh = maxy-miny;

  ctx.strokeRect(minx, miny, bw, bh);

  // corners
  ctx.strokeStyle = "rgba(255,214,74,0.55)";
  ctx.lineWidth = 2;
  const c=14;
  const x=minx, y=miny, W=bw, H=bh;
  ctx.beginPath(); ctx.moveTo(x,y+c); ctx.lineTo(x,y); ctx.lineTo(x+c,y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+W-c,y); ctx.lineTo(x+W,y); ctx.lineTo(x+W,y+c); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y+H-c); ctx.lineTo(x,y+H); ctx.lineTo(x+c,y+H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+W-c,y+H); ctx.lineTo(x+W,y+H); ctx.lineTo(x+W,y+H-c); ctx.stroke();
}

function drawPoseOverlay(ctx, landmarks, w, h){
  // draw only torso + arms (what you asked for)
  // indices from MediaPipe pose: shoulders(11,12), elbows(13,14), wrists(15,16), hips(23,24)
  const idx = [11,12,13,14,15,16,23,24];
  const pts = idx.map(i => landmarks[i]).filter(Boolean).map(p => ({x:p.x*w, y:p.y*h, v:p.visibility ?? 0.0}));

  ctx.strokeStyle = "rgba(120,255,255,0.28)";
  ctx.lineWidth = 1.5;

  function line(i1,i2){
    const a = landmarks[i1], b = landmarks[i2];
    if(!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x*w, a.y*h);
    ctx.lineTo(b.x*w, b.y*h);
    ctx.stroke();
  }

  // shoulders, arms, hips
  line(11,12);
  line(11,13); line(13,15);
  line(12,14); line(14,16);
  line(23,24);
  line(11,23); line(12,24);

  // points
  ctx.fillStyle = "rgba(255,214,74,0.65)";
  for(const p of pts){
    const r = 2 + (p.v*2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    ctx.fill();
  }
}

function computeFidelityFromLandmarksFace(landmarks){
  // fidelity rises with face size (closer/more "captured")
  let minx=1e9, miny=1e9, maxx=-1e9, maxy=-1e9;
  for(const p of landmarks){
    if(p.x<minx) minx=p.x; if(p.y<miny) miny=p.y;
    if(p.x>maxx) maxx=p.x; if(p.y>maxy) maxy=p.y;
  }
  const area = Math.max(0, (maxx-minx) * (maxy-miny)); // 0..~0.4
  const mapped = (area - 0.03) / 0.12; // tune thresholds
  return clamp01(mapped);
}

function computeFidelityFromPose(landmarks){
  // use visibility of shoulders+wrists as "body captured"
  const keys = [11,12,15,16,23,24];
  let sum=0, n=0;
  for(const i of keys){
    const p = landmarks[i];
    if(!p) continue;
    const v = (p.visibility ?? 0.0);
    sum += v; n++;
  }
  if(!n) return 0;
  // visibility is often 0..1 but conservative
  return clamp01((sum/n - 0.25) / 0.55);
}

async function pipRenderLoop(){
  const canvas = $("#pipCanvas");
  const video = $("#pipVideo");
  if(!canvas || !video) return;

  const ctx = canvas.getContext("2d", { alpha:false, desynchronized:true });
  ctx.fillStyle = "#fff";

  function resize(){
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    if(canvas.width !== w || canvas.height !== h){
      canvas.width = w;
      canvas.height = h;
    }
  }

  async function tick(){
    resize();
    const w = canvas.width, h = canvas.height;

    // default: no camera or no frame => black plate
    if(!camOn || video.videoWidth <= 0){
      ctx.fillStyle = "#000";
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.65;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
      ctx.fillText("OFFLINE PLATE", 12, 20);
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
      return;
    }

    // tracking (if available)
    let targetFid = 0.08; // base "always degraded"
    let faceLandmarks = null;
    let poseLandmarks = null;

    if(mp){
      try{
        const now = performance.now();

        if(traceMode === "FACE"){
          const res = mp.face.detectForVideo(video, now);
          const faces = res.faceLandmarks || [];
          if(faces.length){
            faceLandmarks = faces[0];
            targetFid = 0.12 + 0.88 * computeFidelityFromLandmarksFace(faceLandmarks);
          } else {
            targetFid = 0.06;
          }
        } else { // BODY
          const res = mp.pose.detectForVideo(video, now);
          const poses = res.landmarks || res.poseLandmarks || []; // library differences
          const lm = poses[0] || res.landmarks?.[0] || null;
          if(lm){
            poseLandmarks = lm;
            targetFid = 0.12 + 0.88 * computeFidelityFromPose(poseLandmarks);
          } else {
            targetFid = 0.06;
          }
        }
      }catch(e){
        // If tracker glitches, don't kill the PiP. Just degrade.
        targetFid = 0.06;
      }
    }

    // smooth fidelity (feels like "system catching up")
    fidelity = fidelity * 0.92 + targetFid * 0.08;
    fidelity = clamp01(fidelity);

    // draw degraded -> clear based on fidelity
    ctx.fillStyle = "#fff";
    drawPixelated(ctx, video, w, h, fidelity);

    // overlay trace (only if we have it)
    if(faceLandmarks){
      drawFaceOverlay(ctx, faceLandmarks, w, h);
    }
    if(poseLandmarks){
      drawPoseOverlay(ctx, poseLandmarks, w, h);
    }

    // status line
    const mode = traceMode;
    const t = `TRACE ${mode} · FID ${(fidelity).toFixed(2)}`;
    say(t);

    requestAnimationFrame(tick);
  }

  tick();
}

/* ---------- boot ---------- */

function main(){
  renderWorks();
  addMicroInteractions();
  pipFollow();

  const gate = $("#pipGate");
  if(gate) gate.addEventListener("click", toggleCamera);

  const modeBtn = $("#pipMode");
  if(modeBtn) modeBtn.addEventListener("click", toggleMode);

  pipRenderLoop();
}

main();
