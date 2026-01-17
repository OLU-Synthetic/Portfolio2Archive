const WORKS = [
  // Optional: poster, date, medium, status
  { title: "Sludge", file: "works/sludge/index.html", desc: "AI Sludge", date:"2026", medium:"HyperCollage", status:"RUN" },
  { title: "Skull_Dyptych", file: "works/skull_dyptych.html", desc: "delayed self / degraded copy", date:"2026", medium:"WEB", status:"OPEN", poster:"assets/posters/skull_dyptych.jpg" },
  { title: "LATENCY_MIRROR", file: "works/latency_mirror.html", desc: "delayed self / degraded copy", date:"2026", medium:"WEB/CAMERA", status:"RUN" },
  { title: "PANOPTICON_PROTOCOL", file: "works/panopticon_protocol.html", desc: "institutional rite / surveillance logic", date:"2026", medium:"WEB/3D", status:"OPEN" },
  { title: "COLOUR_STUDY_OKLCH", file: "works/colour_study.html", desc: "formal spine / optical pressure", date:"2026", medium:"WEB/GENERATIVE", status:"OPEN" },
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

  const now = performance.now();
  if (say._last && now - say._last < 250) return;
  say._last = now;

  status.textContent = msg;
  status.classList.add("on");
  clearTimeout(say._t);
  say._t = setTimeout(() => status.classList.remove("on"), 650);
}

/* ---------- REGISTRY RENDER ---------- */

function renderWorks() {
  const ul = $("#works");
  if (!ul) return;
  ul.innerHTML = "";

  for (const w of WORKS) {
    const li = document.createElement("li");
    li.className = "work";

    // optional poster (remove formatting if missing)
    if (w.poster) {
      const media = document.createElement("div");
      media.className = "media";

      const img = document.createElement("img");
      img.src = `./${w.poster}`;
      img.alt = `${w.title} poster`;
      img.loading = "lazy";
      img.onerror = () => media.remove();

      media.appendChild(img);
      li.appendChild(media);
    }

    const date = document.createElement("div");
    date.className = "cell date";
    date.textContent = w.date || "—";
    li.appendChild(date);

    const medium = document.createElement("div");
    medium.className = "cell medium";
    medium.textContent = w.medium || "—";
    li.appendChild(medium);

    const titlecell = document.createElement("div");
    titlecell.className = "titlecell";

    const a = document.createElement("a");
    a.className = "titlelink";
    a.href = `./${w.file}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `${escapeHtml(w.title)} <span class="arrow">↗</span>`;
    titlecell.appendChild(a);

    li.appendChild(titlecell);

    const status = document.createElement("div");
    status.className = "cell status";
    status.textContent = (w.status || "OPEN").toUpperCase();
    li.appendChild(status);

    if (w.desc && w.desc.trim()) {
      const d = document.createElement("div");
      d.className = "descrow";
      d.textContent = w.desc;
      li.appendChild(d);
    }

    ul.appendChild(li);
  }
}

function addMicroInteractions() {
  const ul = $("#works");
  if (!ul) return;

  ul.addEventListener("mouseover", (e) => {
    const a = e.target.closest(".titlelink");
    if (a) a.classList.add("hot");
  });
  ul.addEventListener("mouseout", (e) => {
    const a = e.target.closest(".titlelink");
    if (a) a.classList.remove("hot");
  });
}

/* ---------- PiP CLAMP + FOLLOW ---------- */

function clampPipToSlab(){
  const slab = document.querySelector(".col");
  const pipFrame = $("#pipFrame");
  if (!slab || !pipFrame) return;

  const slabRect = slab.getBoundingClientRect();
  const pipW = pipFrame.getBoundingClientRect().width || 200;
  const gap = 18;

  // safeX = left edge so that (pipRight + gap) <= slabLeft
  const safeX = slabRect.left - pipW - gap;

  // if there’s no room, hide PiP (instead of overlapping)
  const pip = document.querySelector(".pip");
  if (!pip) return;

  if (safeX < 8) {
    pip.style.display = "none";
    return;
  } else {
    pip.style.display = "block";
  }

  const x = Math.max(8, safeX);
  document.documentElement.style.setProperty("--pipX", `${x}px`);
}

function pipFollow() {
  const frame = $("#pipFrame");
  if (!frame) return;

  let y = 0, target = 0;

  function updateTarget(){
    target = (window.scrollY || 0) * 0.08;
    clampPipToSlab();
  }

  function tick(){
    y += (target - y) * 0.085;
    frame.style.transform = `translate3d(0, ${y}px, 0)`;
    requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", updateTarget, { passive:true });
  window.addEventListener("resize", updateTarget);
  updateTarget();
  tick();
}

/* ---------- PiP CAMERA + TRACE (same logic) ---------- */

let camOn = false;
let stream = null;

let traceMode = "BODY";
let fidelity = 0;

let mp = null;
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
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
      runningMode: "VIDEO",
      numFaces: 1
    });

    const pose = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" },
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
  if(video) video.srcObject = null;

  camOn = false;
  fidelity = 0;
  document.documentElement.style.setProperty("--glow", "0");

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
  if(camOn){ stopCamera(); return; }

  const video = $("#pipVideo");
  const gate = $("#pipGate");
  const modeBtn = $("#pipMode");

  if(!video || !gate) return;
  if(!window.isSecureContext){ say("DENIED: HTTPS REQUIRED."); return; }
  if(!navigator.mediaDevices?.getUserMedia){ say("DENIED: CAMERA API UNAVAILABLE."); return; }

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
  say(`MODE SET: ${traceMode}.`);
}

/* --- drawing --- */

const PIP = { off:null, offCtx:null };

function ensureOffscreen(){
  if(PIP.off) return;
  PIP.off = document.createElement("canvas");
  PIP.offCtx = PIP.off.getContext("2d", { willReadFrequently:true });
}

function drawPixelated(ctx, srcVideo, w, h, clarity){
  ensureOffscreen();

  const minScale = 0.12;
  const maxScale = 1.0;
  const s = minScale + (maxScale - minScale) * (clarity*clarity);

  const sw = Math.max(2, Math.floor(w * s));
  const sh = Math.max(2, Math.floor(h * s));

  PIP.off.width = sw; PIP.off.height = sh;

  const vw = srcVideo.videoWidth || 1;
  const vh = srcVideo.videoHeight || 1;
  const scale = Math.max(sw / vw, sh / vh);
  const dw = vw * scale, dh = vh * scale;
  const dx = (sw - dw) / 2;
  const dy = (sh - dh) / 2;

  PIP.offCtx.imageSmoothingEnabled = true;
  PIP.offCtx.drawImage(srcVideo, dx, dy, dw, dh);

  // posterize low clarity (real quantization)
  const levels = Math.floor(28 - clarity * 24); // 28 -> 4
  if (levels > 5) {
    const img = PIP.offCtx.getImageData(0,0,sw,sh);
    const d = img.data;
    const step = 255 / (levels - 1);
    for (let i=0; i<d.length; i+=4){
      d[i]   = Math.round(d[i]   / step) * step;
      d[i+1] = Math.round(d[i+1] / step) * step;
      d[i+2] = Math.round(d[i+2] / step) * step;
    }
    PIP.offCtx.putImageData(img,0,0);
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(PIP.off, 0, 0, w, h);

  // scanlines fade with clarity
  ctx.globalAlpha = 0.18 * (1 - clarity);
  ctx.fillStyle = "#fff";
  for(let y=0; y<h; y+=3) ctx.fillRect(0,y,w,1);
  ctx.globalAlpha = 1;

  // vignette fades with clarity
  const g = ctx.createRadialGradient(w*0.5,h*0.5, Math.min(w,h)*0.1, w*0.5,h*0.5, Math.max(w,h)*0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${(0.60 - clarity*0.35).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);
}

function drawFaceOverlay(ctx, landmarks, w, h){
  ctx.strokeStyle = "rgba(120,255,255,0.30)";
  ctx.lineWidth = 1;

  let minx=1e9, miny=1e9, maxx=-1e9, maxy=-1e9;
  for(const p of landmarks){
    const x = p.x*w, y = p.y*h;
    if(x<minx) minx=x; if(y<miny) miny=y;
    if(x>maxx) maxx=x; if(y>maxy) maxy=y;
  }
  const bw = maxx-minx, bh = maxy-miny;
  ctx.strokeRect(minx, miny, bw, bh);

  ctx.strokeStyle = "rgba(255,214,74,0.55)";
  ctx.lineWidth = 2;
  const c=14, x=minx, y=miny, W=bw, H=bh;
  ctx.beginPath(); ctx.moveTo(x,y+c); ctx.lineTo(x,y); ctx.lineTo(x+c,y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+W-c,y); ctx.lineTo(x+W,y); ctx.lineTo(x+W,y+c); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y+H-c); ctx.lineTo(x,y+H); ctx.lineTo(x+c,y+H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+W-c,y+H); ctx.lineTo(x+W,y+H); ctx.lineTo(x+W,y+H-c); ctx.stroke();
}

function drawPoseOverlay(ctx, landmarks, w, h){
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

  // torso + arms
  line(11,12);
  line(11,13); line(13,15);
  line(12,14); line(14,16);
  line(23,24);
  line(11,23); line(12,24);

  // points
  const idx = [11,12,13,14,15,16,23,24];
  ctx.fillStyle = "rgba(255,214,74,0.65)";
  for(const i of idx){
    const p = landmarks[i];
    if(!p) continue;
    const v = p.visibility ?? 0;
    const r = 2 + v*2;
    ctx.beginPath();
    ctx.arc(p.x*w, p.y*h, r, 0, Math.PI*2);
    ctx.fill();
  }
}

function computeFidelityFromLandmarksFace(landmarks){
  let minx=1e9, miny=1e9, maxx=-1e9, maxy=-1e9;
  for(const p of landmarks){
    if(p.x<minx) minx=p.x; if(p.y<miny) miny=p.y;
    if(p.x>maxx) maxx=p.x; if(p.y>maxy) maxy=p.y;
  }
  const area = Math.max(0, (maxx-minx) * (maxy-miny));
  return clamp01((area - 0.03) / 0.12);
}

function computeFidelityFromPose(landmarks){
  const keys = [11,12,15,16,23,24];
  let sum=0, n=0;
  for(const i of keys){
    const p = landmarks[i];
    if(!p) continue;
    sum += (p.visibility ?? 0);
    n++;
  }
  if(!n) return 0;
  return clamp01((sum/n - 0.25) / 0.55);
}

async function pipRenderLoop(){
  const canvas = $("#pipCanvas");
  const video = $("#pipVideo");
  if(!canvas || !video) return;

  const ctx = canvas.getContext("2d", { alpha:false, desynchronized:true });

  function resize(){
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    if(canvas.width !== w || canvas.height !== h){
      canvas.width = w;
      canvas.height = h;
    }
  }

  function tick(){
    resize();
    const w = canvas.width, h = canvas.height;

    if(!camOn || video.videoWidth <= 0){
      ctx.fillStyle = "#000";
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
      ctx.fillText("OFFLINE PLATE", 12, 20);
      requestAnimationFrame(tick);
      return;
    }

    let targetFid = 0.08;
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
        } else {
          const res = mp.pose.detectForVideo(video, now);
          const lm = (res.landmarks && res.landmarks[0]) ? res.landmarks[0] : null;
          if(lm){
            poseLandmarks = lm;
            targetFid = 0.12 + 0.88 * computeFidelityFromPose(poseLandmarks);
          } else {
            targetFid = 0.06;
          }
        }
      }catch{
        targetFid = 0.06;
      }
    }

    // smooth
    fidelity = clamp01(fidelity * 0.92 + targetFid * 0.08);

    // drive background glow
    document.documentElement.style.setProperty("--glow", fidelity.toFixed(3));

    drawPixelated(ctx, video, w, h, fidelity);

    if(faceLandmarks) drawFaceOverlay(ctx, faceLandmarks, w, h);
    if(poseLandmarks) drawPoseOverlay(ctx, poseLandmarks, w, h);

    say(`TRACE ${traceMode} · FID ${fidelity.toFixed(2)}`);

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

  clampPipToSlab();
  pipRenderLoop();
}

main();
