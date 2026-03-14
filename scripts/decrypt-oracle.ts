/**
 * Decrypts oracle.enc -> oracle.json using AES-256-GCM.
 *
 * Usage: npx tsx scripts/decrypt-oracle.ts <password>
 */
import { createDecipheriv, scryptSync } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npx tsx scripts/decrypt-oracle.ts <password>");
  process.exit(1);
}

const encPath = join(__dirname, "..", "data", "oracle.enc");
const outPath = join(__dirname, "..", "data", "oracle.json");

const buf = readFileSync(encPath);
const salt = buf.subarray(0, 32);
const iv = buf.subarray(32, 48);
const authTag = buf.subarray(48, 64);
const encrypted = buf.subarray(64);

const key = scryptSync(password, salt, 32);
const decipher = createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(authTag);
const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

writeFileSync(outPath, decrypted);
console.log(`Decrypted oracle.enc -> oracle.json (${decrypted.length} bytes)`);
