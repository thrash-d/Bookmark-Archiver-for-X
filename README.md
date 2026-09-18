# x-bookmark-downloader

Exports your X (Twitter) bookmarks to disk: metadata, photos, and videos. Everything runs
on your machine. Nothing is uploaded anywhere.

The repository is laid out like this:

- `shared/`: the code both browser builds use (parser, gallery, capture, popup, options,
  icons). Edit the extension here.
- `chrome/`: the Chrome or Edge build. Holds only the Chrome-specific `manifest.json` and
  `background.js`; `build.mjs` copies `shared/` in beside them.
- `firefox/`: the Firefox build. Same idea, with a Firefox `manifest.json` and
  `background.js`. See `firefox/README.md` for the one behavioral difference (Firefox writes
  a timestamped snapshot folder per run, because its download API can't overwrite files).
- `archive.mjs`: a Node script that reads `bookmarks.json` and builds an organized copy
  (searchable HTML gallery, CSV, NDJSON) in a folder you choose. It also downloads HLS-only
  videos, which the browser can't save on its own. HLS downloads require `ffmpeg`.

The extension handles the part that needs your signed-in session. The Node script handles
bulk media downloading, which uses public CDN URLs and needs no sign-in.

## Build

The shared code lives in `shared/` and is copied into each browser build. After a fresh
clone or any change under `shared/`, run:

```
node build.mjs
```

This populates `chrome/` and `firefox/` with the shared files. The copies are build output
and are not committed; only `shared/` and each build's `manifest.json` and `background.js`
are tracked.

## Load the extension

1. Run `node build.mjs` (see above).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `chrome/` folder. (Firefox: see `firefox/README.md`.)

## Run the one-click archive

1. Sign in to x.com and open your bookmarks at `x.com/i/history`.
2. Open the extension popup.
3. Choose a **Date range**: all, last 1, 7, 30, or 90 days, or since a date. The range
   filters by the tweet's post date. X orders bookmarks by when you saved them and doesn't
   expose that timestamp, so the filter can't use the bookmark date.
4. Leave **Stop scrolling after passing the range** on to end the run as soon as it stops
   finding new in-range bookmarks. This option is on by default for every range except
   **All bookmarks**, and it's what makes a short range finish fast. Because bookmark order
   isn't post-date order, it can miss an old post that you bookmarked recently. To scan
   everything and filter at the end, turn it off.
5. Optional: select **Only new since last run** to skip bookmarks you already archived.
6. Click **Archive bookmarks**. A badge on the page shows progress, and the popup shows a
   running summary. To end early and keep what's collected, click **Stop**.

Output lands in a single library folder, `Downloads/x-bookmarks/`:

- `bookmarks.json`: your whole library, rewritten in place each run.
- `index.html`: a searchable offline gallery of the whole library. No Node step needed.
- `media/`: full-resolution photos and direct MP4 videos.
- `failures.json`: media that failed after retries. Written only when there are failures.

### Rerun the archive

Each run merges into the same library instead of creating a new dated folder. Bookmarks are
keyed by tweet ID and media files are named by ID, so:

- New bookmarks are added. Bookmarks you already have are updated in place, not duplicated.
- Media you already downloaded is skipped on later runs. No re-downloading and no
  `file (1)` copies.
- `bookmarks.json` and `index.html` are overwritten with the current full library each run.

You can run the archive weekly with a short date range and the library accumulates. To start
over, open **Options** and click **Reset library**.

Longer videos that X serves only as HLS are recorded in `bookmarks.json` with the
`video_hls` type but aren't downloaded by the extension. The Node script downloads those.

## Archive bookmark folders

To archive a folder, open it on X (`x.com/i/bookmarks/FOLDER_ID`) and click
**Archive bookmarks**. The extension captures that folder's timeline, tags each bookmark
with the folder name, and merges it into your library. Repeat for each folder you want.
The gallery's folder list and the `folder` column in `index.csv` let you filter by folder
afterward. Bookmarks archived from the main bookmarks or history page show as
**No folder**.

There's no single control that walks every folder automatically. You archive each folder
you open, and they all accumulate into one library.

## Run the Node step

The Node step builds the full archive, the gallery, and HLS videos. It requires Node 18 or
later and, for HLS videos, `ffmpeg` on your `PATH`.

```
node archive.mjs "C:\Users\you\Downloads\x-bookmarks\bookmarks.json" archive
```

Options:

- `--days=N`: keep only bookmarks whose tweet was posted in the last N days.
- `--since=YYYY-MM-DD`: keep only bookmarks posted on or after this date.

The script writes the following to the output folder:

- `media/`: every photo and video. HLS videos are muxed to MP4 with `ffmpeg`.
- `index.html`: a self-contained, searchable gallery. Opens offline with no server.
- `index.json`, `bookmarks.ndjson`, `index.csv`: the data in three formats.

If `ffmpeg` is missing, the script prints a banner, skips HLS-only videos, and reports how
many to rerun for after you install it.

## Configure the extension

To open the options page, click **Options** in the popup, or open `chrome://extensions`,
click **Details**, and then click **Extension options**.

- **Scroll delay**: if X rate-limits you, raise it.
- **Re-download all media**: keeps your bookmarks but forgets which media was saved, so
  the next run fetches every photo and video again.
- **Reset library**: forgets everything and starts over.

## Privacy

See `PRIVACY.md`. In short: 100% local, no servers, no telemetry, and the extension never
reads your cookies or tokens.

## Limits

- Media CDN URLs can expire. Run the archive soon after capture.
- X's terms restrict automated collection. This tool reads your own bookmarks through your
  own session. Keep runs occasional and leave the scroll delay in place so you don't trip a
  read-rate flag.
- If capture returns 0, the popup says so. Either you're signed out, you're not on the
  bookmarks or history page, or X changed its API and the extension needs an update.

## How capture works

`parser.js` and `inject.js` run in the page. `inject.js` wraps `fetch` and
`XMLHttpRequest`. When the page requests the `Bookmarks` GraphQL endpoint during a scroll,
`inject.js` copies the JSON response and passes it (origin-scoped) to the content script,
which extracts tweets and media. Nothing forges X's request headers, so the client-side
transaction ID that X requires never has to be reproduced.

## Run the tests

```
node tests/parser.test.cjs
```

The test runs the parser against fixtures that cover photos, videos, HLS-only videos,
quoted-tweet media, visibility-wrapped tweets, long note tweets, folder timelines, and date
parsing.
