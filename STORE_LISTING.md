# Chrome Web Store submission

Paste-ready copy for the developer dashboard. Upload the zip from `dist/`.

## Item name

Bookmark Archiver for X

(Matches `manifest.json`. Named "for X" rather than leading with the trademark to
reduce the chance of a name rejection; the not-affiliated line is in the
description.)

## Summary (max 132 characters)

Export your own X bookmarks — text, photos, and videos — to your computer. 100% local, no account, nothing leaves your machine.

## Category

Productivity

## Language

English

## Description

Save your X (Twitter) bookmarks to your own computer before they disappear.

One click walks your bookmarks, pulls the text, photos, and videos, and writes
them to your Downloads folder along with a searchable offline gallery you can
open any time.

Features:
- One-click archive of your bookmarks, with the photos and videos attached.
- Date range: all, last 1 / 7 / 30 / 90 days, or since a date you pick.
- A searchable, offline HTML gallery — filter by media type or bookmark folder,
  search text and handles, jump back to any post.
- Bookmark folder support: open a folder and archive it; each bookmark is tagged
  with its folder.
- A growing library: re-runs merge in new bookmarks without duplicating files.
- Also writes JSON, CSV, and NDJSON for your own tooling.

Privacy:
- Runs entirely on your machine. No servers, no analytics, no tracking.
- Never reads or transmits your password, cookies, or tokens. It only reads the
  bookmark data the page already loaded while you're signed in.
- Nothing is uploaded anywhere.

Not affiliated with, endorsed by, or sponsored by X Corp. "X" and "Twitter" are
trademarks of their respective owners.

## Single purpose (required)

Export the signed-in user's own X (Twitter) bookmarks, including attached photos
and videos, to local files for personal archiving.

## Permission justifications (required)

- downloads: Save the exported bookmark data, media, and gallery to the user's
  Downloads folder. This is the extension's output.
- storage: Keep the user's growing archive library and settings on their device
  so repeat runs deduplicate and the "only new since last run" option works.
- unlimitedStorage: A large bookmark library can exceed the default extension
  storage quota; this prevents the library from being capped.
- Host permission (x.com, twitter.com): The content script reads the bookmark
  API responses the page loads, on those sites only, to export them. The
  extension runs nowhere else.

## Data usage disclosures (required checkboxes)

- Does the item collect user data? No.
- Sold to third parties? No.
- Used or transferred for purposes unrelated to the item's single purpose? No.
- Used or transferred to determine creditworthiness or for lending? No.

Certify all of the above; the extension stores everything locally and transmits
nothing.

## Privacy policy URL

Host `PRIVACY.md` somewhere public and paste the link. Easiest option: your
GitHub repo file, e.g.
https://github.com/pianowaterfall/Bookmark-Archiver-for-X/blob/main/PRIVACY.md

## Screenshots (required: 1–5, 1280x800 or 640x400 PNG/JPG)

Capture these yourself; they can't be generated from source:
1. The popup with the date range open.
2. The offline gallery (`index.html`) showing a few archived bookmarks with media.
3. The gallery's folder filter or search in use.
4. The options page.

To size them to 1280x800, open each at that window size or crop after capture.
