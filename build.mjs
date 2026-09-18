// Copies the shared source of truth (shared/) into the chrome/ and firefox/ extension
// roots, which each also carry their own manifest.json and background.js. A browser loads
// chrome/ or firefox/ as an unpacked extension; the copied shared files are build output,
// so they are gitignored. Run this after editing anything in shared/.
import { readdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const shared = join(root, "shared");
const targets = ["chrome", "firefox"];
const KEEP = new Set(["manifest.json", "background.js", "README.md"]);

for (const target of targets) {
  const dst = join(root, target);
  // Clear previously copied shared files so a rename or deletion in shared/ doesn't leave
  // a stale copy behind. The per-browser files (KEEP) are never touched.
  for (const name of readdirSync(dst)) {
    if (!KEEP.has(name)) rmSync(join(dst, name), { recursive: true, force: true });
  }
  for (const name of readdirSync(shared)) {
    cpSync(join(shared, name), join(dst, name), { recursive: true });
  }
  console.log(`built ${target}/ (${readdirSync(shared).length} shared entries + manifest.json + background.js)`);
}

if (!existsSync(join(root, "chrome", "manifest.json"))) {
  console.error("warning: chrome/manifest.json missing");
}
