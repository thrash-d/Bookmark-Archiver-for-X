# Bookmark Archiver for X on Firefox

Firefox port of the Chrome extension. Same feature set: one-click capture of your X
bookmarks (text, photos, videos), date-range filtering, a cumulative library, and a
searchable offline gallery. Everything runs locally.

This folder holds only the Firefox-specific `manifest.json` and `background.js`. The shared
code (parser, gallery, capture, popup, options, icons) lives in `../shared/` and is copied
in by `build.mjs`, so run the build from the repo root first.

## Load it in Firefox

Temporary (for testing, cleared when Firefox closes):

1. From the repo root, run `node build.mjs` to populate this folder with the shared files.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select `firefox/manifest.json`.

Permanent install needs a signed build from addons.mozilla.org (AMO). The
`browser_specific_settings.gecko.id` is already set for that.

## Using it

Identical to the Chrome build: sign in to x.com, open your bookmarks, click the toolbar
icon, pick a date range, and click **Archive bookmarks**. Output lands in your Downloads
folder under `x-bookmarks/`.

## The one behavioral difference from the Chrome build

Chrome updates a single `x-bookmarks/` folder in place, overwriting `index.html` and
`bookmarks.json` and skipping media it already downloaded. Firefox's downloads API has no
way to overwrite a file, so instead each run writes a fresh timestamped snapshot:

```
Downloads/x-bookmarks/2026-09-18T14-30-00/
  index.html
  bookmarks.json
  media/
```

Each snapshot is the full current library, self-contained, so `index.html` always opens
with its own media beside it. The cumulative library (and the "only new since last run"
option) still work the same way, because that state lives in extension storage, not in the
files. The tradeoff is that a run re-downloads the library's media into the new snapshot,
and old snapshots stay until you delete them.

## Shared pieces

The Node companion (`archive.mjs`), the privacy policy, and the license live in the repo
root. The parser, gallery, capture, popup, and options code lives in `../shared/` and is the
same for both browsers. Edit it there, not in the copied files here.

## What differs from the Chrome build, for maintainers

Only two files in this folder differ from Chrome; the rest come from `shared/`.

- `manifest.json`: `manifest_version` 3 with `background.scripts` (event page) instead of a
  service worker, and `browser_specific_settings.gecko`.
- `background.js`: no `importScripts` (gallery.js is loaded first via `background.scripts`);
  text files saved via `URL.createObjectURL` blobs instead of `data:` URLs; timestamped
  snapshot folders instead of overwrite; a promise-guarded `relay()`.

The shared `popup.js` uses a small `api = browser || chrome` shim so its `await tabs.*`
calls get promises in both browsers, which is why it works for Chrome and Firefox unchanged.
