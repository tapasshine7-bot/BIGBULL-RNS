import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const accountId = "fa1ff40d263749a0aa47fe056ecc6769";
const workerName = "bigbull-rns-toolmanager-preview-site";
const directory = "/tmp/bigbull-pages-preview";
const previewExcludedPaths = new Set([
  "/apple-touch-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/entrance/backdrop.jpg",
  "/entrance/claw-impact.png",
  "/entrance/crest.png",
  "/entrance/wolf-hero.webp",
]);

const mimeFor = (path) => {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
};

const assets = {};
const walk = (current) => {
  for (const entry of readdirSync(current)) {
    const absolute = join(current, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) walk(absolute);
    if (stat.isFile()) {
      const path = `/${relative(directory, absolute).split(sep).join("/")}`;
      if (previewExcludedPaths.has(path)) continue;
      const bytes = readFileSync(absolute);
      assets[path] = { data: bytes.toString("base64"), type: mimeFor(path) };
    }
  }
};

walk(directory);

const workerCode = `const ASSETS = ${JSON.stringify(assets)};
function bytes(value) {
  const text = atob(value);
  const output = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) output[index] = text.charCodeAt(index);
  return output;
}
export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const url = new URL(request.url);
    const candidate = ASSETS[url.pathname] || ASSETS[url.pathname.endsWith("/") ? url.pathname + "index.html" : ""] || ASSETS["/index.html"];
    const headers = new Headers({ "content-type": candidate.type, "x-robots-tag": "noindex, nofollow" });
    headers.set("cache-control", url.pathname === "/index.html" || url.pathname === "/" ? "no-store" : "public, max-age=31536000, immutable");
    return new Response(request.method === "HEAD" ? null : bytes(candidate.data), { headers });
  }
};`;

const encodedCode = Buffer.from(workerCode, "utf8").toString("base64");
const request = {
  account_id: accountId,
  code: `async () => {
    const code = atob(${JSON.stringify(encodedCode)});
    const metadata = { main_module: "index.js", compatibility_date: "2026-08-18", bindings: [] };
    const boundary = "----BigBullStaticPreview" + Date.now();
    const body = [
      "--" + boundary,
      'Content-Disposition: form-data; name="metadata"',
      "Content-Type: application/json",
      "",
      JSON.stringify(metadata),
      "--" + boundary,
      'Content-Disposition: form-data; name="index.js"; filename="index.js"',
      "Content-Type: application/javascript+module",
      "",
      code,
      "--" + boundary + "--"
    ].join("\\r\\n");
    return cloudflare.request({
      method: "PUT",
      path: "/accounts/" + accountId + "/workers/scripts/" + ${JSON.stringify(workerName)},
      body,
      contentType: "multipart/form-data; boundary=" + boundary,
      rawBody: true
    });
  }`,
};

writeFileSync("/tmp/bigbull-preview-static-site-upload.json", JSON.stringify(request));
console.log(`Prepared ${Object.keys(assets).length} files (${createHash("sha256").update(workerCode).digest("hex").slice(0, 12)}) for the isolated static preview Worker.`);
