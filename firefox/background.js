/* Firefox build. Differences from the Chrome version:
   - Runs as a non-persistent background script (gallery.js is loaded first via the
     manifest's background.scripts, so there is no importScripts here).
   - Firefox's downloads API has no conflictAction, so it cannot overwrite files.
     Each run therefore writes a fresh timestamped snapshot folder under x-bookmarks/
     instead of updating one folder in place, and downloads the full library's media
     into that snapshot. The cumulative library still lives in extension storage. */

const DIR = "x-bookmarks";
const LIB_KEY = "xba_library";
const MAX_RETRIES = 3;
const SUPPORT_URL = "https://buymeacoffee.com/thrashd";

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "archive") {
    archive(msg.records).catch((e) => {
      console.error("XBA archive failed", e);
      relay({ type: "downloads_done", ok: 0, fail: 0, error: String(e) });
    });
  }
});

async function archive(newRecords) {
  const lib = await load(LIB_KEY, {});
  for (const rec of newRecords) lib[rec.id] = rec;
  await save(LIB_KEY, lib);
  const full = Object.values(lib);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = `${DIR}/${stamp}`;

  // Write the gallery + JSON first so every captured bookmark reaches disk even if the
  // media downloads take a while. Links are deterministic filenames within this snapshot.
  await writeOutputs(base, deterministicIndex(full));
  relay({ type: "library_saved", libraryTotal: full.length });

  let ok = 0, fail = 0;
  const failures = [];
  const failedUrls = new Set();

  for (const rec of full) {
    let idx = 0;
    for (const m of rec.media || []) {
      idx++;
      if (m.type !== "photo" && m.type !== "video") continue;
      const key = mediaKey(rec, m, idx);
      const saved = await downloadRetry(m.url, `${base}/media/${key}`);
      if (saved) ok++;
      else { fail++; failures.push({ id: rec.id, url: m.url }); failedUrls.add(m.url); }
      await sleep(120);
      relay({ type: "download_progress", ok, fail });
    }
  }

  if (failures.length) {
    await saveData(`${base}/failures.json`, JSON.stringify(failures, null, 2), "application/json");
    await writeOutputs(base, confirmedIndex(full, failedUrls));
  }

  relay({ type: "downloads_done", ok, fail, libraryTotal: full.length });
}

async function writeOutputs(base, index) {
  await saveData(`${base}/bookmarks.json`, JSON.stringify(index, null, 2), "application/json");
  if (self.XBAGallery) {
    await saveData(`${base}/index.html`, self.XBAGallery.build(index, SUPPORT_URL), "text/html");
  }
}

function deterministicIndex(full) {
  return full.map((r) => ({
    ...r,
    media: (r.media || []).map((m, i) => {
      const isFile = m.type === "photo" || m.type === "video";
      return { ...m, file: isFile ? mediaKey(r, m, i + 1) : null };
    })
  }));
}

function confirmedIndex(full, failedUrls) {
  return full.map((r) => ({
    ...r,
    media: (r.media || []).map((m, i) => {
      const isFile = m.type === "photo" || m.type === "video";
      return { ...m, file: isFile && !failedUrls.has(m.url) ? mediaKey(r, m, i + 1) : null };
    })
  }));
}

function mediaKey(rec, m, idx) {
  const ext = m.type === "photo" ? imgExt(m.url) : "mp4";
  return `${rec.id}-${idx}.${ext}`;
}

async function downloadRetry(url, filename) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const id = await tryDownload(url, filename);
    if (id !== null) return true;
    await sleep(attempt * 1000);
  }
  return false;
}

function tryDownload(url, filename) {
  return new Promise((resolve) => {
    try {
      chrome.downloads.download({ url, filename, saveAs: false }, (id) => {
        if (chrome.runtime.lastError || id === undefined) resolve(null);
        else resolve(id);
      });
    } catch (_) { resolve(null); }
  });
}

// Firefox background pages can use URL.createObjectURL (a service worker can't), so text
// files go out as blobs rather than data: URLs.
function saveData(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  return downloadRetry(url, filename).then((okv) => {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return okv;
  });
}

function load(key, fallback) {
  return new Promise((res) => {
    try { chrome.storage.local.get(key, (v) => res((v && v[key]) || fallback)); }
    catch (_) { res(fallback); }
  });
}
function save(key, value) {
  return new Promise((res) => {
    try { chrome.storage.local.set({ [key]: value }, () => res()); }
    catch (_) { res(); }
  });
}

function imgExt(url) {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".webp")) return "webp";
  if (clean.endsWith(".gif")) return "gif";
  return "jpg";
}

// Firefox's chrome.runtime.sendMessage returns undefined (no promise), so guard the catch.
function relay(m) {
  try { const p = chrome.runtime.sendMessage(m); if (p && p.catch) p.catch(() => {}); }
  catch (_) { /* no receiver */ }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
