(function () {
  const TAG = "XBA_CAPTURE";
  const HISTORY_URL = "https://x.com/i/history";
  const ON_PAGE = /^\/i\/(bookmarks|history)/;
  const STORE_KEY = "xba_library";

  const tweets = new Map();
  let running = false;
  let cancelled = false;
  let rateLimitHits = 0;
  let opts = { sinceMs: null, incremental: false, scrollDelay: 2200, earlyStop: true };

  const parser = self.XBAParser;

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("inject.js");
  s.onload = function () { this.remove(); };
  (document.head || document.documentElement).appendChild(s);

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.source !== TAG) return;
    if (d.kind === "ratelimit") { rateLimitHits++; return; }
    if (d.kind !== "data") return;
    let recs = [];
    try { recs = parser.collectEntries(d.payload); } catch (_) { return; }
    const folder = currentFolder();
    for (const rec of recs) {
      if (!rec || tweets.has(rec.id)) continue;
      if (folder) { rec.folder = folder.name; rec.folder_id = folder.id; }
      tweets.set(rec.id, rec);
    }
    const inRange = opts.sinceMs ? countInRange() : null;
    badge(inRange != null ? `${inRange} in range (${tweets.size} scanned)` : `${tweets.size} captured`);
    send({ type: "progress", count: tweets.size, inRange });
  });

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg.cmd === "start") { opts = Object.assign(opts, msg.opts || {}); start(); reply({ ok: true }); }
    else if (msg.cmd === "cancel") { cancelled = true; reply({ ok: true }); }
    else if (msg.cmd === "status") { reply({ running, count: tweets.size }); }
    return true;
  });

  function start() {
    if (running) return;
    if (!ON_PAGE.test(location.pathname)) {
      badge("Open Bookmarks/History, then click Archive again.");
      location.href = HISTORY_URL;
      return;
    }
    running = true;
    cancelled = false;
    rateLimitHits = 0;
    harvest();
  }

  async function harvest() {
    badge("Scrolling bookmarks…");
    let stagnant = 0;
    let lastSize = -1;
    let lastCells = -1;
    let loops = 0;
    let lastRlSeen = 0;
    let lastInRange = -1;
    let stagnantInRange = 0;
    const MAX_LOOPS = 8000;
    const EARLY_STOP_STREAK = 6;

    while (stagnant < 8 && loops < MAX_LOOPS && !cancelled) {
      loops++;

      if (rateLimitHits > lastRlSeen) {
        lastRlSeen = rateLimitHits;
        if (rateLimitHits >= 5) {
          badge("Rate-limited by X repeatedly — stopping with what we have.");
          break;
        }
        const backoff = Math.min(30000, 5000 * rateLimitHits);
        badge(`Rate-limited — backing off ${Math.round(backoff / 1000)}s (${rateLimitHits}/5)`);
        await sleep(backoff);
        continue;
      }

      const cells = document.querySelectorAll('[data-testid="cellInnerDiv"]');
      const last = cells[cells.length - 1];
      if (last) last.scrollIntoView({ block: "end" });
      else {
        const el = document.scrollingElement || document.documentElement;
        el.scrollTo(0, el.scrollHeight);
      }
      window.dispatchEvent(new Event("scroll"));
      await sleep(opts.scrollDelay);

      const grew = tweets.size > lastSize || cells.length > lastCells;
      if (grew) { lastSize = tweets.size; lastCells = cells.length; stagnant = 0; }
      else { stagnant++; badge(`${tweets.size} captured — waiting (${stagnant}/8)`); }

      if (opts.earlyStop && opts.sinceMs) {
        const inRange = countInRange();
        if (inRange > lastInRange) { lastInRange = inRange; stagnantInRange = 0; }
        else stagnantInRange++;
        if (stagnantInRange >= EARLY_STOP_STREAK && lastInRange >= 0) {
          badge(`Scrolled past your date range — stopping (${inRange} in range).`);
          break;
        }
      }

      if (atEnd()) break;
    }
    finalize();
  }

  function atEnd() {
    const empty = document.querySelector('[data-testid="emptyState"]');
    return !!empty && tweets.size > 0;
  }

  function currentFolder() {
    const m = location.pathname.match(/^\/i\/bookmarks\/(\d+)/);
    if (!m) return null;
    let name = null;
    const h = document.querySelector('[data-testid="primaryColumn"] h2');
    if (h && h.textContent && h.textContent.trim()) name = h.textContent.trim();
    return { id: m[1], name: name || ("Folder " + m[1]) };
  }

  function countInRange() {
    if (!opts.sinceMs) return tweets.size;
    let n = 0;
    for (const r of tweets.values()) {
      if (r.created_ms == null || r.created_ms >= opts.sinceMs) n++;
    }
    return n;
  }

  async function finalize() {
    running = false;
    let records = [...tweets.values()];
    const captured = records.length;

    if (captured === 0) {
      badge("Captured 0 — X may have changed. Tool needs an update.");
      send({ type: "error", message: "Captured 0 bookmarks. Either you're logged out, not on the bookmarks/history page, or X changed its API and the extension needs updating." });
      return;
    }

    if (opts.sinceMs) {
      records = records.filter((r) => r.created_ms == null || r.created_ms >= opts.sinceMs);
    }

    if (opts.incremental) {
      const prior = new Set(await getLibraryIds());
      records = records.filter((r) => !prior.has(r.id));
    }

    const kept = records.length;
    const mediaCount = records.reduce((n, r) => n + (r.media ? r.media.length : 0), 0);

    if (kept === 0) {
      badge(`Captured ${captured}, but 0 matched your filters.`);
      send({ type: "summary", captured, kept, media: 0, cancelled });
      return;
    }

    badge(`Done — ${kept} bookmarks (${captured} scanned). Saving…`);
    send({ type: "summary", captured, kept, media: mediaCount, cancelled });

    // The background worker owns the cumulative library: it merges, deduplicates, and
    // regenerates the outputs. The content script only reports what this run captured.
    send({ type: "archive", records });
  }

  function getLibraryIds() {
    return new Promise((res) => {
      try {
        chrome.storage.local.get(STORE_KEY, (v) => res(Object.keys((v && v[STORE_KEY]) || {})));
      } catch (_) { res([]); }
    });
  }

  function send(m) { try { chrome.runtime.sendMessage(m).catch(() => {}); } catch (_) {} }

  function badge(msg) {
    let el = document.getElementById("xba-badge");
    if (!el) {
      el = document.createElement("div");
      el.id = "xba-badge";
      el.style.cssText =
        "position:fixed;z-index:999999;bottom:16px;right:16px;background:#15202b;" +
        "color:#fff;font:13px system-ui;padding:10px 14px;border-radius:8px;" +
        "border:1px solid #38444d;box-shadow:0 4px 16px rgba(0,0,0,.4);max-width:320px";
      document.body.appendChild(el);
    }
    el.textContent = "X Archiver: " + msg;
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
})();
