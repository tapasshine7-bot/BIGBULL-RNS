import { readFileSync, writeFileSync } from "node:fs";

const accountId = "fa1ff40d263749a0aa47fe056ecc6769";
const workerName = "bigbull-rns-api";
const productionD1Id = "c7c415d7-ec40-42c7-aae7-9b1168030fea";
const code = readFileSync("/tmp/bigbull-production-worker/index.js", "utf8");
const encodedCode = Buffer.from(code, "utf8").toString("base64");

const request = {
  account_id: accountId,
  code: `async () => {
    const code = atob(${JSON.stringify(encodedCode)});
    const metadata = {
      main_module: "index.js",
      compatibility_date: "2026-08-18",
      bindings: [
        { type: "d1", name: "db", id: ${JSON.stringify(productionD1Id)} }
      ]
    };
    const boundary = "----BigBullProduction" + Date.now();
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

writeFileSync("/tmp/bigbull-production-worker-upload.json", JSON.stringify(request));
