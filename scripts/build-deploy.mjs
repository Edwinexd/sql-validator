/*
Cloudflare Pages build command for the SQL Validator.

Assembles a single deploy tree:
  build/                          -> live app (Vite base "/")
  build/compatibility/<date>/     -> immutable full-app build pinned by compatibility.json

Compatibility dates are declared in compatibility.json at the repo root:
  { "2026-07-04": "<commit-sha>" }
Each entry maps a date to an immutable commit. This script rebuilds every pinned
commit under its own base path (/compatibility/<date>/) so the pinned build
fetches its own frozen questionpool/database and uses an isolated localStorage
namespace (see src/storage.ts). Pin a date with `npm run compat:cut`.

Only pin commits that already contain the compatibility machinery (this feature
onward); older commits fetch assets from the site root and would not isolate. A
missing-machinery commit is detected and skipped.

This IS the normal build (`npm run build`), so Cloudflare Pages needs no config
change. The single-app build lives in `npm run build:app`, which this script
invokes for the live root and for each snapshot.
*/
import { execSync } from "node:child_process";
import {
  existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync, symlinkSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "build");
const WORKTREES = join(ROOT, ".compat-worktrees");
const CONFIG = join(ROOT, "compatibility.json");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const tryRun = (cmd, opts = {}) => { try { run(cmd, { stdio: "ignore", ...opts }); return true; } catch { return false; } };
const capture = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", ...opts }).trim();

// Cloudflare Pages does a shallow clone; make full history available so any
// pinned commit can be checked out.
function ensureHistory() {
  if (!tryRun("git fetch --tags --force --unshallow")) tryRun("git fetch --tags --force");
}

function readConfig() {
  if (!existsSync(CONFIG)) { console.warn("! compatibility.json not found; deploying live root only."); return []; }
  let raw;
  try { raw = JSON.parse(readFileSync(CONFIG, "utf8")); }
  catch (e) { console.error(`! compatibility.json is invalid JSON: ${e.message}`); return []; }
  const entries = [];
  for (const [date, ref] of Object.entries(raw)) {
    if (!DATE_RE.test(date)) { console.warn(`  skip "${date}": not YYYY-MM-DD`); continue; }
    if (typeof ref !== "string" || !ref) { console.warn(`  skip ${date}: missing commit`); continue; }
    entries.push({ date, ref });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  return entries;
}

function resolveCommit(ref) {
  try { return capture(`git rev-parse --verify "${ref}^{commit}"`); }
  catch {
    // Commit may be absent in a shallow clone; try to fetch it, then retry.
    tryRun(`git fetch --force origin "${ref}"`);
    return capture(`git rev-parse --verify "${ref}^{commit}"`);
  }
}

function installDeps(worktree) {
  // Reuse the root install when the lockfile is byte-identical (fast path on CF);
  // otherwise do a clean install for that commit's pinned dependencies.
  const rootLock = readFileSync(join(ROOT, "package-lock.json"), "utf8");
  const wtLock = readFileSync(join(worktree, "package-lock.json"), "utf8");
  if (wtLock === rootLock && existsSync(join(ROOT, "node_modules"))) {
    symlinkSync(join(ROOT, "node_modules"), join(worktree, "node_modules"), "dir");
  } else {
    run("npm ci", { cwd: worktree });
  }
}

function buildSnapshot({ date, ref }) {
  const sha = resolveCommit(ref);
  // Guard: the pinned commit must contain the compatibility machinery.
  if (!tryRun(`git cat-file -e ${sha}:src/storage.ts`)) {
    throw new Error(`commit ${sha.slice(0, 10)} predates the compatibility machinery (no src/storage.ts)`);
  }
  const base = `/compatibility/${date}/`;
  const worktree = join(WORKTREES, date);
  console.log(`\n=== compatibility snapshot ${date} (${sha.slice(0, 10)}) base=${base} ===`);
  run(`git worktree add --detach --force "${worktree}" "${sha}"`);
  try {
    installDeps(worktree);
    run("npm run build:app", { cwd: worktree, env: { ...process.env, APP_BASE: base } });
    const dest = join(OUT, "compatibility", date);
    mkdirSync(join(OUT, "compatibility"), { recursive: true });
    rmSync(dest, { recursive: true, force: true });
    cpSync(join(worktree, "build"), dest, { recursive: true });
  } finally {
    tryRun(`git worktree remove --force "${worktree}"`);
  }
}

function writeRoutingFiles(dates) {
  // SPA fallback: dated builds fall back to their own index.html, everything else to root.
  const redirects = [
    ...dates.map(d => `/compatibility/${d}/* /compatibility/${d}/index.html 200`),
    "/* /index.html 200",
  ].join("\n") + "\n";
  writeFileSync(join(OUT, "_redirects"), redirects);

  // Snapshots are immutable -> cache them hard.
  const headers = dates.map(d =>
    `/compatibility/${d}/*\n  Cache-Control: public, max-age=31536000, immutable`
  ).join("\n\n") + (dates.length ? "\n" : "");
  writeFileSync(join(OUT, "_headers"), headers);

  mkdirSync(join(OUT, "compatibility"), { recursive: true });
  writeFileSync(join(OUT, "compatibility", "index.json"), JSON.stringify(dates) + "\n");
}

// --- run ---------------------------------------------------------------------
const compat = readConfig();
if (compat.length) ensureHistory();

console.log("=== live root build (base /) ===");
run("npm run build:app");

console.log(`\nPinned compatibility date(s): ${compat.map(c => c.date).join(", ") || "none"}`);

rmSync(WORKTREES, { recursive: true, force: true });
mkdirSync(WORKTREES, { recursive: true });

const built = [];
const failed = [];
for (const c of compat) {
  try { buildSnapshot(c); built.push(c.date); }
  catch (e) { console.error(`! FAILED snapshot ${c.date}: ${e.message}`); failed.push(c.date); }
}
rmSync(WORKTREES, { recursive: true, force: true });

writeRoutingFiles(built);

console.log(`\nDeploy assembled: live root + ${built.length} snapshot(s): ${built.join(", ") || "none"}`);
if (failed.length) console.error(`! ${failed.length} snapshot(s) FAILED and were left out: ${failed.join(", ")}`);
