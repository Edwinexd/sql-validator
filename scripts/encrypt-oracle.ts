/**
 * Encrypts oracle.json -> oracle.enc using AES-256-GCM.
 *
 * Usage: npx tsx scripts/encrypt-oracle.ts <password>
 */
import { createCipheriv, randomBytes, scryptSync } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npx tsx scripts/encrypt-oracle.ts <password>");
  process.exit(1);
}

const oraclePath = join(__dirname, "oracle.json");
const encPath = join(__dirname, "oracle.enc");

const plaintext = readFileSync(oraclePath, "utf-8");

// Derive key from password
const salt = randomBytes(32);
const key = scryptSync(password, salt, 32);

// Encrypt with AES-256-GCM
const iv = randomBytes(16);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
const authTag = cipher.getAuthTag();

// Write: salt (32) + iv (16) + authTag (16) + encrypted data
const output = Buffer.concat([salt, iv, authTag, encrypted]);
writeFileSync(encPath, output);

console.log(`Encrypted oracle.json -> oracle.enc (${output.length} bytes)`);
