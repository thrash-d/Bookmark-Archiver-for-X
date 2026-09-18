import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { build: buildGallery } = require(join(dirname(fileURLToPath(import.meta.url)), "shared", "gallery.js"));

const SUPPORT_URL = "https://buymeacoffee.com/thrashd";
const CONCURRENCY = 4;
const MAX_RETRIES = 3;

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);

const INPUT = positional[0] || "bookmarks.json";
const OUTDIR = positional[1] || "archive";
const MEDIADIR = join(OUTDIR, "media");
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

function cutoffMs() {
  if (flags.since) {
    const ms = Date.parse(String(flags.since) + "T00:00:00Z");
    return isNaN(ms) ? null : ms;
  }
  if (flags.days) {
    const d = parseInt(flags.days, 10);
    return isNaN(d) ? null : Date.now() - d * 86400000;
  }
  return null;
}

async function main() {
  if (flags.help || !existsSync(INPUT)) {
    console.log("Usage: node archive.mjs <bookmarks.json> [outdir] [--days=N] [--since=YYYY-MM-DD]");
    if (!existsSync(INPUT)) { console.error(`\nInput not found: ${INPUT}`); process.exit(1); }
    return;
  }

  let records = JSON.parse(await readFile(INPUT, "utf8"));
  const total = records.length;

  const cut = cutoffMs();
  if (cut != null) {
    records = records.filter((r) => msOf(r) == null || msOf(r) >= cut);
    console.log(`Date filter: ${records.length} of ${total} bookmarks kept (cutoff ${new Date(cut).toISOString().slice(0, 10)}).`);
  }

  await mkdir(MEDIADIR, { recursive: true });

  const hlsCount = records.reduce(
    (n, r) => n + (r.media || []).filter((m) => m.type === "video_hls").length, 0
  );
  if (!hasFfmpeg && hlsCount) {
    console.log("");
    console.log("  ################################################################");
    console.log("  #  ffmpeg NOT found on PATH.                                    #");
    console.log(`  #  ${String(hlsCount).padEnd(4)} HLS-only video(s) will be SKIPPED.               #`);
    console.log("  #  Install it, then re-run to grab them:                        #");
    console.log("  #    winget install Gyan.FFmpeg      (Windows)                  #");
    console.log("  #    brew install ffmpeg             (macOS)                    #");
    console.log("  #    sudo apt install ffmpeg         (Debian/Ubuntu)            #");
    console.log("  ################################################################");
    console.log("");
  }

  const jobs = [];
  for (const rec of records) {
    let i = 0;
    for (const m of rec.media || []) { i++; jobs.push({ rec, m, i }); }
  }

  console.log(`${records.length} bookmarks, ${jobs.length} media files.`);
  let done = 0, ok = 0, skipped = 0, failed = 0, hlsSkipped = 0;

  async function worker() {
    while (jobs.length) {
      const res = await handle(jobs.shift());
      done++;
      if (res === "ok") ok++;
      else if (res === "hls_skip") { hlsSkipped++; skipped++; }
      else if (res === "skip") skipped++;
      else failed++;
      if (done % 10 === 0 || jobs.length === 0) {
        process.stdout.write(`\r${done}/${done + jobs.length} (${ok} ok, ${skipped} skip, ${failed} fail)   `);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write("\n");

  const index = records.map((r) => ({
    ...r,
    media: (r.media || []).map((m, idx) => {
      const file = mediaName(r, m, idx + 1);
      return { ...m, file: existsSync(join(MEDIADIR, file)) ? file : null };
    })
  }));

  await writeFile(join(OUTDIR, "index.json"), JSON.stringify(index, null, 2));
  await writeFile(join(OUTDIR, "bookmarks.ndjson"), index.map((r) => JSON.stringify(r)).join("\n") + "\n");
  await writeFile(join(OUTDIR, "index.csv"), toCsv(index));
  await writeFile(join(OUTDIR, "index.html"), buildGallery(index, SUPPORT_URL));

  console.log("");
  console.log(`Saved:   ${ok}`);
  console.log(`Skipped: ${skipped}` + (hlsSkipped ? `  (${hlsSkipped} HLS videos, no ffmpeg)` : ""));
  console.log(`Failed:  ${failed}`);
  console.log(`Output:  ${OUTDIR}/  — open index.html (also index.json, index.csv, bookmarks.ndjson)`);
  if (hlsSkipped) {
    console.log(`\n>> ${hlsSkipped} video(s) skipped for missing ffmpeg. Install it (above) and re-run.`);
  }
}

function msOf(r) {
  if (typeof r.created_ms === "number") return r.created_ms;
  if (r.created_at) { const t = Date.parse(r.created_at); return isNaN(t) ? null : t; }
  return null;
}

async function handle({ rec, m, i }) {
  const name = mediaName(rec, m, i);
  const out = join(MEDIADIR, name);
  if (existsSync(out)) return "skip";
  if (m.type === "photo" || m.type === "video") {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const r = await fetch(m.url);
        if (r.ok) { await writeFile(out, Buffer.from(await r.arrayBuffer())); return "ok"; }
      } catch (_) {}
      await sleep(attempt * 800);
    }
    return "fail";
  }
  if (m.type === "video_hls") {
    if (!hasFfmpeg) return "hls_skip";
    return await muxHls(m.url, out);
  }
  return "skip";
}

function muxHls(url, out) {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", url, "-c", "copy", "-bsf:a", "aac_adtstoasc", out]);
    p.on("close", (code) => resolve(code === 0 ? "ok" : "fail"));
    p.on("error", () => resolve("fail"));
  });
}

function mediaName(rec, m, i) {
  const ext = m.type === "photo" ? imgExt(m.url) : "mp4";
  return `${rec.id}-${i}.${ext}`;
}
function imgExt(url) {
  try {
    const u = new URL(url);
    const fmt = u.searchParams.get("format");
    if (fmt) return fmt;
    const p = u.pathname.toLowerCase();
    if (p.endsWith(".png")) return "png";
    if (p.endsWith(".webp")) return "webp";
    if (p.endsWith(".gif")) return "gif";
  } catch (_) {}
  return "jpg";
}
function sanitize(s) { return String(s).replace(/[^a-z0-9_-]/gi, "_").slice(0, 40); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function toCsv(index) {
  const q = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
  const head = ["id", "screen_name", "created_at", "url", "folder", "quoted_of", "media_count", "text"];
  const rows = index.map((r) => [
    r.id, r.screen_name, r.created_at, r.url, r.folder || "", r.quoted_of || "",
    (r.media || []).length, r.text
  ].map(q).join(","));
  return head.join(",") + "\n" + rows.join("\n") + "\n";
}

main();
