# Privacy policy

X Bookmark Archiver runs entirely on your own computer. It has no backend.

## What the extension does

- Reads the bookmark data that X sends to your browser while you're signed in and viewing
  your own bookmarks, and saves it to your Downloads folder.
- Downloads the photos and videos attached to those bookmarks to the same folder.
- Stores a local list of the bookmark IDs you've already archived in the browser's extension
  storage, so that the **Only new since last run** option works. You can clear this list at
  any time from the options page.

## What the extension doesn't do

- It has no servers. Nothing is uploaded anywhere. There are no analytics, no telemetry, and
  no tracking.
- It doesn't read, collect, or transmit your password, cookies, or auth tokens. It observes
  the bookmark API responses that the page already made. It never forges requests and never
  handles credentials.
- It doesn't contact any site other than x.com, twitter.com, and the X media CDNs that your
  bookmarks link to.

## Data location

Everything the tool produces lives in your `Downloads/x-bookmarks/` folder and in the
extension's local storage on your machine. Deleting those removes all data the tool holds.

## Permissions

- `downloads`: saves files to your Downloads folder.
- `storage`: remembers which bookmarks you've archived and your settings.
- Host access to `x.com` and `twitter.com`: reads the bookmark data on those pages.

## Contact

This is a local, open tool with no data collection. Send questions or issues to the
project's repository.
