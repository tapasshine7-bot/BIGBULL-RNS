// Seeds all reference data into D1 via the Cloudflare D1 HTTP API.
// Usage: node seed-node.js
const fs = require("fs");
const path = require("path");

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = "c7c415d7-ec40-42c7-aae7-9b1168030fea";

const sql = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8");

(async () => {
  const statements = sql.split("\n").filter((l) => l.trim().startsWith("INSERT"));
  // Dedupe by statement text (idempotent)
  const unique = [...new Map(statements.map((s) => [s, s])).values()];
  console.log(`Total unique INSERT statements: ${unique.length}`);

  let failed = 0;
  for (let i = 0; i < unique.length; i++) {
    const s = unique[i];
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql: s, params: [] }),
    });
    const data = await res.json();
    const ok = data.success && data.result && data.result[0] && data.result[0].success;
    const changes = ok ? data.result[0].changes ?? 0 : "-";
    if (!ok) {
      failed += 1;
      console.log(`[${i + 1}] FAILED:`, (data.errors ?? [{}])[0]?.message ?? JSON.stringify(data).slice(0, 300));
      console.log("   SQL:", s.slice(0, 120).replace(/\n/g, " "));
    } else {
      console.log(`[${i + 1}] ok (changes=${changes})`);
    }
  }
  console.log(failed ? `\nFAILED COUNT: ${failed}` : "\nALL SEEDS OK");
  process.exit(failed ? 1 : 0);
})();
