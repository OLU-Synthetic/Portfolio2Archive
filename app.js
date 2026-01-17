// Edit WORKS only.
// Optional fields per work: date, medium, duration, role, poster, videoPoster

const WORKS = [
  {
    title: "Skull_Dyptych",
    file: "works/Skull/Skull.html",
    desc: "delayed self / degraded copy",
    date: "2026",
    medium: "WEB / HTML",
    duration: "LOOP",
    poster: "assets/posters/skull_dyptych.jpg"
  },
  {
    title: "LATENCY_MIRROR",
    file: "works/latency_mirror.html",
    desc: "delayed self / degraded copy",
    date: "2026",
    medium: "WEB / CAMERA",
    duration: "REALTIME",
    poster: "assets/posters/latency_mirror.jpg"
  },
  {
    title: "PANOPTICON_PROTOCOL",
    file: "works/panopticon_protocol.html",
    desc: "institutional rite / surveillance logic",
    date: "2026",
    medium: "WEB / 3D",
    duration: "RUNTIME",
    poster: "assets/posters/panopticon_protocol.jpg"
  },
  {
    title: "COLOUR_STUDY_OKLCH",
    file: "works/colour_study.html",
    desc: "formal spine / optical pressure",
    date: "2026",
    medium: "WEB / GENERATIVE",
    duration: "LOOP",
    poster: "assets/posters/colour_study_oklch.jpg"
  },
];

const $ = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[m]);
}

function renderWorks() {
  const ul = $("#works");
  if (!ul) return;
  ul.innerHTML = "";

  for (const w of WORKS) {
    const li = document.createElement("li");
    li.className = "work";

    // optional poster slot
    if (w.poster) {
      const media = document.createElement("div");
      media.className = "media";

      const img = document.createElement("img");
      img.src = `./${w.poster}`;
      img.alt = `${w.title} poster`;
      img.loading = "lazy";

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

    // metadata tags (optional)
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

// micro brutality
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

// PiP damped follow
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

// Camera gate (kept simple; your existing version is fine)
async function enableCam() {
  const video = $("#pipVideo");
  const gate = $("#pipGate");
  const status = $("#pipStatus");
  if (!video || !gate || !status) return;

  const say = (msg) => {
    status.textContent = msg;
    status.classList.add("on");
    clearTimeout(say._t);
    say._t = setTimeout(() => status.classList.remove("on"), 2200);
  };

  if (!window.isSecureContext) { say("DENIED: HTTPS REQUIRED."); return; }
  if (!navigator.mediaDevices?.getUserMedia) { say("DENIED: API UNAVAILABLE."); return; }

  gate.disabled = true;
  gate.textContent = "REQUESTING…";
  say("REQUESTING PERMISSION…");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user" }, audio:false });
    video.srcObject = stream;
    await video.play().catch(()=>{});
    gate.textContent = "CAM ENABLED ↗";
    say("INPUT ACCEPTED.");
  } catch (err) {
    gate.disabled = false;
    gate.textContent = "ENABLE CAM ↗";
    say(`DENIED: ${err?.name || "ERROR"}.`);
    console.error(err);
  }
}

function main(){
  renderWorks();
  addMicroInteractions();
  pipFollow();
  const gate = $("#pipGate");
  if (gate) gate.addEventListener("click", enableCam);
}
main();
