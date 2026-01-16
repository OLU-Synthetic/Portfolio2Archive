// Portfolio2Archive index logic.
// Edit WORKS only. Everything else is enforcement.

const WORKS = [
  // IMPORTANT: files are case-sensitive on GitHub Pages.
  { type: "HTML", title: "LATENCY_MIRROR", file: "works/latency_mirror.html", desc: "delayed self / elsewhere feed" },
  { type: "HTML", title: "PANOPTICON_PROTOCOL", file: "works/panopticon_protocol.html", desc: "institutional rite / surveillance logic" },
  { type: "HTML", title: "COLOUR_STUDY_OKLCH", file: "works/colour_study.html", desc: "formal spine / perceptual pressure" },
];

const $ = (sel) => document.querySelector(sel);

function normalize(s){ return (s ?? "").toString().trim().toLowerCase(); }

function render(list){
  const ul = $("#list");
  ul.innerHTML = "";

  if (!list.length){
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "NO MATCHES. INPUT REJECTED.";
    ul.appendChild(li);
    $("#count").textContent = "0";
    return;
  }

  for (const w of list){
    const li = document.createElement("li");
    li.className = "item";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = w.type;

    const title = document.createElement("div");
    title.className = "title";
    const a = document.createElement("a");
    a.href = `./${w.file}`; // RELATIVE PATH: works on /<repo-name>/ project pages.
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = w.title;
    title.appendChild(a);

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = w.desc ?? "";

    li.append(meta, title, desc);
    ul.appendChild(li);
  }

  $("#count").textContent = String(list.length);
}

function main(){
  const q = $("#q");
  render(WORKS);

  q.addEventListener("input", () => {
    const query = normalize(q.value);
    if (!query) return render(WORKS);

    const filtered = WORKS.filter(w => {
      const hay = `${w.title} ${w.type} ${w.file} ${w.desc}`.toLowerCase();
      return hay.includes(query);
    });

    render(filtered);
  });

  // Initial count
  $("#count").textContent = String(WORKS.length);
}

main();
