// Edit WORKS only.
const WORKS = [
  { title: "LATENCY_MIRROR", file: "works/latency_mirror.html", desc: "delayed self / degraded copy" },
  { title: "PANOPTICON_PROTOCOL", file: "works/panopticon_protocol.html", desc: "institutional rite / surveillance logic" },
  { title: "COLOUR_STUDY_OKLCH", file: "works/colour_study.html", desc: "formal spine / optical pressure" },
];

const $ = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[m]);
}

function renderWorks() {
  const ul = $("#works");
  if (!ul) {
    console.error("[INDEX] Missing #works in index.html");
    return;
  }
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

function pipFollow() {
  const frame = $("#pipFrame");
  if (!frame) return;

  let currentY = 0, targetY = 0;

  function updateTarget() { targetY = (window.scrollY || 0) * 0.08; }
  function tick() {
    currentY += (targetY - currentY) * 0.085;
    frame.style.transform = `translate3d(0, ${currentY}px, 0)`;
    requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", updateTarget, { passive: true });
  updateTarget();
  tick();
}

async function enableCam() {
  const video = $("#pipVideo");
  const gate = $("#pipGate");
  const status = $("#pipStatus");
  if (!video || !gate || !status) return;

  const say = (msg) => {
    status.textContent = msg;
    status.classList.add("on");
    clearTimeout(say._t);
    say._t = setTimeout(() => status.classList.remove("on"), 1800);
  };

  gate.disabled = true;
  gate.textContent = "REQUESTING…";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    video.srcObject = stream;
    gate.textContent = "CAM ENABLED ↗";
    say("INPUT ACCEPTED.");
  } catch {
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
