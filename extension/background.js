try { importScripts("gallery.js"); } catch (e) { console.error("XBA gallery load failed", e); }

const DIR = "x-bookmarks";
const LIB_KEY = "xba_library";
const DONE_KEY = "xba_media_done";
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
  const done = new Set(await load(DONE_KEY, []));

  for (const rec of newRecords) lib[rec.id] = rec;
  await save(LIB_KEY, lib);

  const full = Object.values(lib);

  let ok = 0, fail = 0;
  const failures = [];

  // Backfill the whole library, not just this run. The gallery is built from the full
  // library, so media from earlier runs that never finished must be fetched here or the
  // gallery points at missing files. `done` holds confirmed downloads so reruns skip them;
  // "overwrite" prevents `file (1)` duplicates.
  for (const rec of full) {
    let idx = 0;
    for (const m of rec.media || []) {
      idx++;
      if (m.type !== "photo" && m.type !== "video") continue;
      const key = mediaKey(rec, m, idx);
      if (done.has(key)) continue;
      const saved = await downloadRetry(m.url, `${DIR}/media/${key}`, "overwrite");
      if (saved) { ok++; done.add(key); }
      else { fail++; failures.push({ id: rec.id, url: m.url }); }
      await sleep(300);
      relay({ type: "download_progress", ok, fail });
    }
  }
  await save(DONE_KEY, Array.from(done));

  // Link only media confirmed on disk so the gallery never points at a missing file.
  const index = full.map((r) => ({
    ...r,
    media: (r.media || []).map((m, i) => {
      const isFile = m.type === "photo" || m.type === "video";
      const key = mediaKey(r, m, i + 1);
      return { ...m, file: isFile && done.has(key) ? key : null };
    })
  }));

  await saveData(`${DIR}/bookmarks.json`, JSON.stringify(index, null, 2), "application/json", "overwrite");
  if (failures.length) {
    await saveData(`${DIR}/failures.json`, JSON.stringify(failures, null, 2), "application/json", "overwrite");
  }
  if (self.XBAGallery) {
    await saveData(`${DIR}/index.html`, self.XBAGallery.build(index, SUPPORT_URL), "text/html", "overwrite");
  }

  relay({ type: "downloads_done", ok, fail, libraryTotal: full.length });
}

function mediaKey(rec, m, idx) {
  const ext = m.type === "photo" ? imgExt(m.url) : "mp4";
  return `${rec.id}-${idx}.${ext}`;
}

async function downloadRetry(url, filename, conflict) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const id = await tryDownload(url, filename, conflict);
    if (id !== null) return true;
    await sleep(attempt * 1000);
  }
  return false;
}

function tryDownload(url, filename, conflict) {
  return new Promise((resolve) => {
    try {
      chrome.downloads.download(
        { url, filename, conflictAction: conflict || "uniquify" },
        (id) => {
          if (chrome.runtime.lastError || id === undefined) resolve(null);
          else resolve(id);
        }
      );
    } catch (_) { resolve(null); }
  });
}

function saveData(filename, text, mime, conflict) {
  const url = "data:" + mime + ";charset=utf-8," + encodeURIComponent(text);
  return downloadRetry(url, filename, conflict);
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

function relay(m) { chrome.runtime.sendMessage(m).catch(() => {}); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
