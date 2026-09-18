// Firefox exposes promise-based tabs APIs on `browser`; Chrome MV3 returns promises on
// `chrome`. Use whichever gives promises so `await tabs.query(...)` works in both.
const api = (typeof browser !== "undefined" && browser.runtime) ? browser : chrome;
const $ = (id) => document.getElementById(id);
const goBtn = $("go");
const cancelBtn = $("cancel");
const rangeSel = $("range");
const sinceInput = $("since");
const statusEl = $("status");
const summaryEl = $("summary");

$("ver").textContent = "v" + chrome.runtime.getManifest().version;

const PREFS_KEY = "xba_prefs";

function syncControls() {
  sinceInput.style.display = rangeSel.value === "since" ? "block" : "none";
  $("earlyRow").style.display = rangeSel.value === "all" ? "none" : "flex";
}

function savePrefs() {
  const prefs = {
    range: rangeSel.value,
    since: sinceInput.value,
    earlyStop: $("earlyStop").checked,
    incremental: $("incremental").checked
  };
  try { chrome.storage.local.set({ [PREFS_KEY]: prefs }); } catch (_) {}
}

function loadPrefs() {
  return new Promise((res) => {
    try { chrome.storage.local.get(PREFS_KEY, (v) => res((v && v[PREFS_KEY]) || {})); }
    catch (_) { res({}); }
  });
}

async function initPrefs() {
  const p = await loadPrefs();
  if (p.range) rangeSel.value = p.range;
  if (p.since) sinceInput.value = p.since;
  if (typeof p.earlyStop === "boolean") $("earlyStop").checked = p.earlyStop;
  if (typeof p.incremental === "boolean") $("incremental").checked = p.incremental;
  syncControls();
}

["range", "since", "earlyStop", "incremental"].forEach((id) => {
  $(id).addEventListener("change", () => { syncControls(); savePrefs(); });
});

initPrefs();

$("opts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function setStatus(t) { statusEl.textContent = t; }

function computeSinceMs() {
  const v = rangeSel.value;
  if (v === "all") return null;
  if (v === "since") {
    if (!sinceInput.value) return null;
    const ms = Date.parse(sinceInput.value + "T00:00:00");
    return isNaN(ms) ? null : ms;
  }
  const days = parseInt(v, 10);
  return Date.now() - days * 86400000;
}

function running(on) {
  goBtn.style.display = on ? "none" : "block";
  cancelBtn.style.display = on ? "block" : "none";
}

async function getSettings() {
  return new Promise((res) => {
    try {
      chrome.storage.local.get("xba_settings", (v) => res((v && v.xba_settings) || {}));
    } catch (_) { res({}); }
  });
}

goBtn.addEventListener("click", async () => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/(x|twitter)\.com/.test(tab.url || "")) {
    await api.tabs.create({ url: "https://x.com/i/history" });
    setStatus("Opened your bookmarks — click the icon again to start.");
    return;
  }
  const settings = await getSettings();
  const opts = {
    sinceMs: computeSinceMs(),
    incremental: $("incremental").checked,
    earlyStop: $("earlyStop").checked,
    scrollDelay: Math.max(800, parseInt(settings.scrollDelay, 10) || 2200)
  };
  summaryEl.innerHTML = "";
  running(true);
  setStatus("Starting…");
  try {
    await api.tabs.sendMessage(tab.id, { cmd: "start", opts });
    setStatus("Running — you can close this popup.");
  } catch (_) {
    setStatus("Reload the X tab, then try again.");
    running(false);
  }
});

cancelBtn.addEventListener("click", async () => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  try { await api.tabs.sendMessage(tab.id, { cmd: "cancel" }); } catch (_) {}
  setStatus("Stopping…");
});

function renderSummary(rows) {
  summaryEl.innerHTML = rows
    .map(([k, v]) => `<div><span class="k">${k}</span><span>${v}</span></div>`)
    .join("");
}

let lastSummary = null;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "progress") {
    setStatus(msg.inRange != null
      ? `${msg.inRange} in range (${msg.count} scanned)…`
      : `Captured ${msg.count}…`);
  }
  else if (msg.type === "error") { setStatus("⚠ " + msg.message); running(false); }
  else if (msg.type === "summary") {
    lastSummary = msg;
    renderSummary([
      ["Scanned", msg.captured],
      ["Matched filters", msg.kept],
      ["Media files", msg.media]
    ]);
    if (msg.kept === 0) running(false);
  }
  else if (msg.type === "library_saved") setStatus(`Saved ${msg.libraryTotal} bookmarks. Fetching media…`);
  else if (msg.type === "download_progress") setStatus(`Downloading media… ${msg.ok} ok, ${msg.fail} failed`);
  else if (msg.type === "downloads_done") {
    running(false);
    setStatus(`Done. Open Downloads/x-bookmarks/index.html.`);
    const rows = [];
    if (lastSummary) {
      rows.push(["New this run", lastSummary.kept]);
    }
    rows.push(["Media saved", msg.ok]);
    if (msg.fail) rows.push(["Media failed", msg.fail]);
    if (typeof msg.libraryTotal === "number") rows.push(["Library total", msg.libraryTotal]);
    renderSummary(rows);
  }
});
