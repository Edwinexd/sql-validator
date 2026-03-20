/**
 * Generates a JSON file with license information for all production dependencies.
 * Output: public/licenses.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const NODE_MODULES = join(ROOT, "node_modules");

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  repository?: string;
  author?: string;
}

// Read the root package.json to get production dependencies
const rootPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const prodDeps = Object.keys(rootPkg.dependencies || {});

function resolvePackage(name: string): LicenseEntry | null {
  const pkgDir = join(NODE_MODULES, name);
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) return null;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  const license = typeof pkg.license === "string"
    ? pkg.license
    : typeof pkg.license === "object"
      ? pkg.license.type
      : Array.isArray(pkg.licenses)
        ? pkg.licenses.map((l: { type: string }) => l.type).join(", ")
        : "Unknown";

  const repo = typeof pkg.repository === "string"
    ? pkg.repository
    : typeof pkg.repository === "object"
      ? pkg.repository.url
      : undefined;

  const cleanRepo = repo
    ?.replace(/^git\+/, "")
    ?.replace(/^git:\/\//, "https://")
    ?.replace(/\.git$/, "")
    ?.replace(/^ssh:\/\/git@github\.com/, "https://github.com");

  const author = typeof pkg.author === "string"
    ? pkg.author
    : typeof pkg.author === "object"
      ? pkg.author.name
      : undefined;

  return {
    name: pkg.name,
    version: pkg.version,
    license,
    repository: cleanRepo,
    author,
  };
}

const entries: LicenseEntry[] = [];

for (const dep of prodDeps) {
  const entry = resolvePackage(dep);
  if (entry) entries.push(entry);
}

// Sort alphabetically
entries.sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(join(ROOT, "public", "licenses.json"), JSON.stringify(entries, null, 2));
console.log(`Generated licenses.json with ${entries.length} dependencies`);
