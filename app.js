// Minimal brutal index + damped PiP follow + opt-in webcam.
// Edit WORKS only.

const WORKS = [
  // file paths are RELATIVE to index.html (repo root)
  { title: "LATENCY_MIRROR", file: "works/latency_mirror.html", desc: "delayed self / degraded copy" },
  { title: "PANOPTICON_PROTOCOL", file: "works/panopticon_protocol.html", desc: "institutional rite / surveillance logic" },
  { title: "COLOUR_STUDY_OKLCH", file: "works/colour_study.html", desc: "formal spine / optical pressure" },
];

const $ = (sel) => document.querySelector(sel);

function renderWorks() {
  const ul = $("#works");
  ul.innerHTML = "";

  for (const w of WORKS) {
    const li = document.createElement("li");
    li.className = "work";

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

    ul.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[m]);
}

// --- PiP damped follow ---
function pipFollow() {
  const frame = $("#pipFrame");
  if (!frame) return;

  let currentY = 0;
  let targetY = 0;

  // "float with damping": lerp toward scroll-reactive offset
  function updateTarget() {
    const scrollY = window.scrollY || 0;
    // subtle: you feel it, it doesn't become a toy
    targetY = scrollY * 0.08; // adjust 0.05–0.12 to taste
  }

  function tick() {
    // critically damped-ish feel via simple smoothing
    currentY += (targetY - currentY) * 0.085; // damping strength
    frame.style.transform = `translate3d(0, ${currentY}px, 0)`;
    requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", updateTarget, { passive: true });
  updateTarget();
  tick();
}

// --- Webcam gate ---
async function enableCam() {
  const video = $("#pipVideo");
  const gate = $("#pipGate");
  const status = $("#pipStatus");

  const say = (msg) => {
    status.textContent = msg;
    status.classList.add("on");
    window.clearTimeout(say._t);
    say._t = window.setTimeout(() => status.classList.remove("on"), 1800);
  };

  if (!navigator.mediaDevices?.getUserMedia) {
    say("CAMERA API UNAVAILABLE.");
    return;
  }

  gate.disabled = true;
  gate.textContent = "REQUESTING…";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    gate.textContent = "CAM ENABLED ↗";
    say("INPUT ACCEPTED.");
  } catch (err) {
    gate.disabled = false;
    gate.textContent = "ENABLE CAM ↗";
    say("DENIED.");
  }
}

function main() {
  renderWorks();
  pipFollow();

  const gate = $("#pipGate");
  if (gate) gate.addEventListener("click", enableCam);
}

main();
