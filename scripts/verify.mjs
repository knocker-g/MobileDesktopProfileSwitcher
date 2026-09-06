import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const checkedRoots = ["src", "test", "scripts"];
const textFiles = ["manifest.json", "package.json"];

async function collectFiles(directory) {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(relative)));
    else files.push(relative);
  }

  return files;
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${String(result.status)}`);
  }
}

const files = (await Promise.all(checkedRoots.map(collectFiles))).flat();
const JavaScriptFiles = files.filter((file) => /\.(?:js|mjs)$/.test(file));

const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const popupPath = manifest.action?.default_popup;
if (popupPath !== "src/ui/popup.html") throw new Error("Single popup manifest entry is missing");
const popupHtml = await readFile(path.join(root, popupPath), "utf8");
const popupCss = await readFile(path.join(root, "src/ui/popup.css"), "utf8");
if (!/<script type="module" src="popup\.js"><\/script>/.test(popupHtml)) {
  throw new Error("Popup module script entry is invalid");
}
if (/https?:\/\//i.test(popupHtml) || /\b(?:100)?v[wh]\b/.test(popupCss)) {
  throw new Error("Popup contains a remote URL or unstable viewport sizing");
}
console.log("PASS popup HTML/CSS/manifest contract");
const packageMetadata = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
if (packageMetadata.dependencies || packageMetadata.devDependencies) {
  throw new Error("Phase 1 must not declare external dependencies");
}
console.log("PASS JSON validation");

for (const file of JavaScriptFiles) {
  run(process.execPath, ["--check", file], `Syntax check: ${file}`);
}
console.log(`PASS JavaScript syntax (${JavaScriptFiles.length} files)`);

for (const file of [...files, ...textFiles]) {
  const content = await readFile(path.join(root, file), "utf8");
  if (/[^\S\r\n]+$/m.test(content)) {
    throw new Error(`Trailing whitespace: ${file}`);
  }
}
console.log("PASS product-tree whitespace check");

const productJavaScriptFiles = JavaScriptFiles.filter((file) =>
  file.startsWith(`src${path.sep}`),
);
const productSource = (
  await Promise.all(
    productJavaScriptFiles.map((file) => readFile(path.join(root, file), "utf8")),
  )
).join("\n");
const forbiddenRuntimePatterns = [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bsendBeacon\b/,
  /https?:\/\/(?!\$\{|\*)[a-z0-9]/i,
  /Chrome\/(?:148|154)\.0\.0\.0/,
];

for (const pattern of forbiddenRuntimePatterns) {
  if (pattern.test(productSource)) {
    throw new Error(`Forbidden runtime/profile pattern: ${String(pattern)}`);
  }
}
console.log("PASS no remote configuration, telemetry, or experiment fixture");

const chromeIndependentFiles = productJavaScriptFiles.filter(
  (file) => !file.endsWith(`${path.sep}service-worker.js`) && !file.endsWith(`${path.sep}ui${path.sep}popup.js`),
);
for (const file of chromeIndependentFiles) {
  const content = await readFile(path.join(root, file), "utf8");
  if (/\bchrome\./.test(content)) {
    throw new Error(`Global Chrome API escaped its entry-point boundary: ${file}`);
  }
}
console.log("PASS Chrome API entry-point boundary");

const forbiddenDnrProductPatterns = [
  /Sec-CH-UA/i,
  /\bregexFilter\b/,
  /\bresponseHeaders\b/,
  /\bredirect\b/,
];
for (const pattern of forbiddenDnrProductPatterns) {
  if (pattern.test(productSource)) {
    throw new Error(`Forbidden product DNR capability: ${String(pattern)}`);
  }
}
console.log("PASS DNR product safety boundary");

run(process.execPath, ["--test"], "Node tests");
run("git", ["diff", "--check"], "git diff --check");
run("git", ["diff", "--cached", "--check"], "git diff --cached --check");
console.log("PASS git diff checks");
console.log("VERIFY PASS");
