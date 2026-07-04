/*
Pin a compatibility date to an immutable commit in compatibility.json.

  npm run compat:cut                    # pin today's date to HEAD
  npm run compat:cut -- 2026-07-04      # explicit date, HEAD
  npm run compat:cut -- 2026-07-04 master   # explicit date and ref

Writes compatibility.json; commit and push it to master. The next deploy freezes
that commit at /compatibility/<date>/. No git tags involved. Published dates are
immutable: re-pinning an existing date to a different commit is refused.
*/
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const CONFIG = join(process.cwd(), "compatibility.json");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const cap = (c) => execSync(c, { encoding: "utf8" }).trim();

const [dateArg, refArg] = process.argv.slice(2);
const date = dateArg || new Date().toISOString().slice(0, 10);
const ref = refArg || "HEAD";

if (!DATE_RE.test(date)) { console.error(`Date must be YYYY-MM-DD, got: ${date}`); process.exit(1); }

let sha, subject;
try {
  sha = cap(`git rev-parse --verify "${ref}^{commit}"`);
  subject = cap(`git show -s --format=%s ${sha}`);
} catch { console.error(`Could not resolve ref: ${ref}`); process.exit(1); }

const cfg = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, "utf8")) : {};
if (cfg[date] && cfg[date] !== sha) {
  console.error(`! ${date} is already pinned to ${cfg[date]}; published dates must stay immutable. Refusing to move it.`);
  process.exit(1);
}
cfg[date] = sha;

const sorted = Object.fromEntries(Object.keys(cfg).sort().reverse().map(k => [k, cfg[k]]));
writeFileSync(CONFIG, JSON.stringify(sorted, null, 2) + "\n");

console.log(`Pinned ${date} -> ${sha}`);
console.log(`  ${subject}`);
console.log(`\nNext: commit compatibility.json and push to master. The next deploy publishes /compatibility/${date}/.`);
