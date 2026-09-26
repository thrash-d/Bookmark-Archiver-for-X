# Changelog

## 1.4.11

- The exported gallery footer names the extension Bookmark Archiver for X instead of its old working name, x-bookmark-downloader.

## 1.4.10

- Fixed new bookmarks not appearing in the gallery. The gallery and JSON were written after the media backfill loop, which on a larger library ran long enough for the background service worker to be terminated first, so the files never updated. The gallery and JSON are now written before any media downloads, so every captured bookmark reaches disk regardless of how long media takes or whether the worker is stopped. Media file links are deterministic; a file still downloading shows a broken image until the next pass fetches it. Shortened the per-file delay to reduce total run time.

## 1.4.9

- Renamed to "Bookmark Archiver for X" (extension name, popup, options, privacy policy) for the Chrome Web Store listing.

## 1.4.8

- Set the Buy me a coffee link to the project's real handle.

## 1.4.7

- Gallery header and search bar now align with the content column instead of spanning the full window width, fixing the top-heavy look on wide screens.

## 1.4.6

- Moved the "nothing leaves your machine" note and the Buy me a coffee link out of the crowded popup footer and onto the options page. The popup footer now holds only the Options link.

## 1.4.5

- Visual pass on the gallery, popup, and options page: calmer, denser layout with color and weight reserved for interactive elements. The gallery is now a single divided list instead of a stack of cards; buttons, pills, and headers are toned down. No behavior changed.
- README and privacy policy rewritten in Google developer documentation style. Code comments trimmed to only those explaining non-obvious decisions.

## 1.4.4

- Popup settings (date range, since-date, early-stop, "only new") now persist across opening/closing the popup and reloads.

## 1.4.3

- Fixed the gallery referencing media that was never downloaded ("looking for many images, only a few saved"). The gallery is built from the whole library, but downloads had been narrowed to just the current run, so bookmarks carried over from earlier runs pointed at missing files. Downloads now backfill the entire library (every photo/video not yet confirmed on disk), and the gallery links only media that actually saved, so the two always match.
- Options: added "Re-download all media" (re-fetch every photo/video on the next run without losing your bookmarks), alongside "Reset library".

## 1.4.2

- Fixed downloaded media not appearing in the extension's gallery. The gallery's `file` link was gated on an in-memory download cache that could be out of sync with what was actually saved, so photos/videos downloaded but rendered blank. The link now uses the deterministic media filename (nulled only for HLS or a media that failed this run), matching the Node gallery's behavior. Removed the unused cache.

## 1.4.1

- Fixed media not downloading on re-runs. The "already downloaded" cache was skipping every media file once it had been seen, so repeat runs (and runs after you'd deleted media) saved the HTML/JSON but no media. The current run's media is now always fetched (idempotent overwrite, still no duplicates).

## 1.4.0

- Bookmark folder support. Open a folder and click Archive: the extension captures that folder's timeline (`BookmarkFolderTimeline`) and tags each bookmark with the folder name. The gallery gains a folder dropdown and a per-card folder chip; the CSV gains a `folder` column. Everything merges into the same library, so archiving each folder builds one tagged collection.
- Parser now finds the timeline by shape (any `*_timeline` with instructions) instead of hard-coded keys, which covers folder timelines and survives future key renames of the main feed.

## 1.3.0

- Cumulative library: runs merge into one `Downloads/x-bookmarks/` folder instead of a new dated folder each time. Bookmarks are keyed by tweet ID, media files are named by ID, so re-runs deduplicate: already-downloaded media is skipped and `bookmarks.json` / `index.html` are rewritten with the full library. No more duplicate files or `file (1)` copies.
- Fixed author showing as `@unknown`: X moved `screen_name` from the user's `legacy` object to its `core` object; the parser now reads both.
- Progress now shows in-range count when a date filter is set (e.g. "1 in range (240 scanned)") instead of just the raw scanned number.
- Added `unlimitedStorage` so large libraries aren't capped by the default extension storage quota.
- Options: "Reset library" replaces "reset archived history".

## 1.2.0

- Extension now writes `index.html` (the searchable gallery) itself, so the viewer exists after one click. No Node step required to browse your archive.
- Gallery template shared between the extension and the Node script (single source).
- Date range gained a "Last 1 day" option and an early-stop toggle that ends the run once it stops finding in-range bookmarks, so short ranges finish fast instead of scrolling everything.

## 1.1.0

- Date-range filtering: archive all, last 7 / 30 / 90 days, or since a chosen date (by tweet post date).
- "Only new since last run" incremental mode, backed by local storage; reset it from Options.
- Fail-loud: a capture that returns 0 now reports that X changed or you're logged out, instead of finishing silently.
- Rate-limit handling: detects X throttling, backs off, and stops cleanly after repeated hits.
- Quoted-tweet media is now captured.
- Origin-scoped internal messaging so page scripts can't read captured data.
- Download retries with backoff; failures written to `failures.json`.
- Options page (scroll delay, reset archived history).
- Popup shows a run summary, a Stop button, and the version.
- Parser extracted into a tested module.
- Node companion: `--days` / `--since` filters, plus `index.csv` and `bookmarks.ndjson` exports.
- Icons, privacy policy, license, hardened manifest (CSP, least-privilege permissions).

## 1.0.0

- One-click auto-scroll capture of X bookmarks via the page's own API responses.
- Saves `bookmarks.json` plus photos and mp4 videos to Downloads.
- Node companion downloads full-resolution media, muxes HLS-only videos with ffmpeg, and builds an offline HTML gallery.
