(function () {
  const TAG = "XBA_CAPTURE";
  const ORIGIN = location.origin;

  function isBookmarks(url) {
    return typeof url === "string" &&
      (url.includes("/Bookmarks") || url.includes("/BookmarkFolderTimeline"));
  }

  function post(kind, payload) {
    window.postMessage({ source: TAG, kind, payload }, ORIGIN);
  }

  function isRateLimited(status, json) {
    if (status === 429) return true;
    const errs = json && json.errors;
    if (Array.isArray(errs)) {
      return errs.some((e) => e && (e.code === 88 || /rate limit/i.test(e.message || "")));
    }
    return false;
  }

  function handle(status, text) {
    let json = null;
    try { json = JSON.parse(text); } catch (_) { return; }
    if (isRateLimited(status, json)) { post("ratelimit", { status }); return; }
    post("data", json);
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0] && args[0].url;
      if (isBookmarks(url)) {
        const status = res.status;
        res.clone().text().then((t) => handle(status, t)).catch(() => {});
      }
    } catch (_) {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__xba_url = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (isBookmarks(this.__xba_url)) {
      this.addEventListener("load", function () {
        try {
          if (this.responseType === "" || this.responseType === "text") {
            handle(this.status, this.responseText);
          }
        } catch (_) {}
      });
    }
    return origSend.apply(this, arguments);
  };
})();
