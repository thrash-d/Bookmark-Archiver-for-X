const SETTINGS_KEY = "xba_settings";
const LIB_KEY = "xba_library";
const DONE_KEY = "xba_media_done";
const scrollDelay = document.getElementById("scrollDelay");
const savedEl = document.getElementById("saved");
const archivedCount = document.getElementById("archivedCount");

function load() {
  chrome.storage.local.get([SETTINGS_KEY, LIB_KEY], (v) => {
    const s = (v && v[SETTINGS_KEY]) || {};
    scrollDelay.value = s.scrollDelay || 2200;
    const lib = (v && v[LIB_KEY]) || {};
    archivedCount.textContent = `${Object.keys(lib).length} bookmark(s) in your library.`;
  });
}

document.getElementById("save").addEventListener("click", () => {
  const s = { scrollDelay: Math.max(800, Math.min(10000, parseInt(scrollDelay.value, 10) || 2200)) };
  chrome.storage.local.set({ [SETTINGS_KEY]: s }, () => {
    savedEl.textContent = "Saved ✓";
    setTimeout(() => (savedEl.textContent = ""), 1500);
  });
});

document.getElementById("redownload").addEventListener("click", () => {
  chrome.storage.local.set({ [DONE_KEY]: [] }, () => {
    savedEl.textContent = "Media will re-download on next run ✓";
    setTimeout(() => (savedEl.textContent = ""), 2000);
  });
});

document.getElementById("clear").addEventListener("click", () => {
  chrome.storage.local.set({ [LIB_KEY]: {}, [DONE_KEY]: [] }, () => {
    archivedCount.textContent = "0 bookmark(s) in your library.";
    savedEl.textContent = "Library cleared ✓";
    setTimeout(() => (savedEl.textContent = ""), 1500);
  });
});

load();
