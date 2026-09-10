import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
export const repositoryRoot = path.resolve(scriptDirectory, "..");
export const allowlistPath = path.join(scriptDirectory, "cws-package-files.json");
export const FIXED_ZIP_DOS_DATE = 0x0021; // 1980-01-01
export const FIXED_ZIP_DOS_TIME = 0;

const ZIP_LOCAL_FILE = 0x04034b50;
const ZIP_CENTRAL_FILE = 0x02014b50;
const ZIP_END = 0x06054b50;
const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

export function crc32(content) {
  let value = 0xffffffff;
  for (const byte of content) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function assertSafeArchivePath(file) {
  if (
    typeof file !== "string"
    || file.length === 0
    || file.includes("\\")
    || file.startsWith("/")
    || /^[a-z]:/i.test(file)
    || file.split("/").includes("..")
  ) {
    throw new Error(`Unsafe CWS package path: ${String(file)}`);
  }
}

export async function loadCwsAllowlist(root = repositoryRoot) {
  const source = root === repositoryRoot
    ? allowlistPath
    : path.join(root, "scripts", "cws-package-files.json");
  const files = JSON.parse(await readFile(source, "utf8"));
  if (!Array.isArray(files) || files.length === 0) throw new Error("CWS allowlist must be a non-empty array");
  for (const file of files) assertSafeArchivePath(file);
  if (new Set(files).size !== files.length) throw new Error("CWS allowlist contains duplicate paths");
  if (files.join("\n") !== [...files].sort().join("\n")) throw new Error("CWS allowlist must use stable lexical ordering");
  return Object.freeze([...files]);
}

function localHeader(name, content, checksum) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(ZIP_LOCAL_FILE, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(STORE_METHOD, 8);
  header.writeUInt16LE(FIXED_ZIP_DOS_TIME, 10);
  header.writeUInt16LE(FIXED_ZIP_DOS_DATE, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(content.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(name, content, checksum, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(ZIP_CENTRAL_FILE, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(STORE_METHOD, 10);
  header.writeUInt16LE(FIXED_ZIP_DOS_TIME, 12);
  header.writeUInt16LE(FIXED_ZIP_DOS_DATE, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(content.length, 20);
  header.writeUInt32LE(content.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

export async function createCwsZip({ root = repositoryRoot, outputPath } = {}) {
  const allowlist = await loadCwsAllowlist(root);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of allowlist) {
    const name = Buffer.from(file, "utf8");
    const content = await readFile(path.join(root, ...file.split("/")));
    const checksum = crc32(content);
    const local = localHeader(name, content, checksum);
    localParts.push(local, name, content);
    centralParts.push(centralHeader(name, content, checksum, offset), name);
    offset += local.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(allowlist.length, 8);
  end.writeUInt16LE(allowlist.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  const archive = Buffer.concat([...localParts, centralDirectory, end]);
  if (outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, archive);
  }
  return archive;
}

function findEndRecord(archive) {
  const minimum = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === ZIP_END) return offset;
  }
  throw new Error("ZIP end record is missing");
}

export function inspectCwsZip(archive) {
  const endOffset = findEndRecord(archive);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  const entries = [];
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== ZIP_CENTRAL_FILE) throw new Error("Invalid ZIP central directory");
    const method = archive.readUInt16LE(cursor + 10);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    assertSafeArchivePath(name);
    if (method !== STORE_METHOD || compressedSize !== size) throw new Error(`Unsupported ZIP method: ${name}`);
    if (archive.readUInt32LE(localOffset) !== ZIP_LOCAL_FILE) throw new Error(`Missing local ZIP entry: ${name}`);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const contentStart = localOffset + 30 + localNameLength + localExtraLength;
    const content = archive.subarray(contentStart, contentStart + size);
    if (crc32(content) !== checksum) throw new Error(`CRC mismatch: ${name}`);
    entries.push(Object.freeze({ name, content }));
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  if (new Set(entries.map(({ name }) => name)).size !== entries.length) {
    throw new Error("ZIP contains duplicate entries");
  }
  return Object.freeze(entries);
}

const forbiddenPackagePaths = [
  /(^|\/)\./,
  /(^|\/)(?:assets|docs|investigation|node_modules|scripts|test)(\/|$)/,
  /(^|\/)(?:README(?:\.ja)?\.md|PRIVACY(?:\.ja)?\.md|package(?:-lock)?\.json)$/,
  /\.(?:crx|env|log|map|pem|zip)$/i,
];

const forbiddenTextPatterns = [
  { label: "personal Gmail address", pattern: /[a-z0-9._%+-]+@gmail\.com/i },
  { label: "GitHub noreply address", pattern: /[a-z0-9+._-]+@users\.noreply\.github\.com/i },
  { label: "absolute Windows user path", pattern: /[a-z]:\\Users\\/i },
  { label: "localhost development URL", pattern: /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "bearer token", pattern: /\bBearer\s+[a-z0-9._~-]{12,}/i },
  { label: "assigned API secret", pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/i },
  { label: "unfinished marker", pattern: /\b(?:TODO|TBD|VERIFY IN CWS UI)\b/ },
  { label: "investigation-only behavior", pattern: /\b(?:youtubei|visitorData|LiveFlow|NicoFlow)\b/i },
];

export async function verifyCwsZip(archive, { root = repositoryRoot } = {}) {
  const allowlist = await loadCwsAllowlist(root);
  const entries = inspectCwsZip(archive);
  const names = entries.map(({ name }) => name);
  if (names.join("\n") !== allowlist.join("\n")) throw new Error("ZIP entries do not exactly match the CWS allowlist");

  for (const name of names) {
    if (forbiddenPackagePaths.some((pattern) => pattern.test(name))) {
      throw new Error(`Excluded artifact in CWS ZIP: ${name}`);
    }
  }

  for (const entry of entries) {
    if (!/\.(?:css|html|js|json|md)$/i.test(entry.name) && entry.name !== "LICENSE") continue;
    const text = entry.content.toString("utf8");
    for (const { label, pattern } of forbiddenTextPatterns) {
      if (pattern.test(text)) throw new Error(`${label} found in CWS ZIP entry: ${entry.name}`);
    }
  }

  const manifestEntry = entries.find(({ name }) => name === "manifest.json");
  const manifest = JSON.parse(manifestEntry.content.toString("utf8"));
  const repositoryManifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  if (manifest.version !== repositoryManifest.version || manifest.version !== "1.0.1") {
    throw new Error("CWS ZIP manifest version mismatch");
  }
  return Object.freeze({ entries, manifest });
}

export async function defaultOutputPath(root = repositoryRoot) {
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  return path.join(root, "dist", `mobile-desktop-profile-switcher-v${manifest.version}.zip`);
}

async function main() {
  const outputPath = await defaultOutputPath();
  await createCwsZip({ outputPath });
  const archive = await readFile(outputPath);
  const { entries } = await verifyCwsZip(archive);
  console.log(`CWS PACKAGE PASS (${entries.length} files)`);
  console.log(path.relative(repositoryRoot, outputPath).replaceAll(path.sep, "/"));
  console.log(`${archive.length} bytes`);
  console.log(`SHA-256 ${createHash("sha256").update(archive).digest("hex")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await main();
}
