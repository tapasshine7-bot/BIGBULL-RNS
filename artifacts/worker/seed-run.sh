#!/bin/bash
# Runs each INSERT from seed-data.sh one at a time via wrangler d1 execute.
set -u
cd "$(dirname "$0")"
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:?set me}"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:?set me}"
DB="bigbull-rns-db"
OUT=/tmp/seed_out.txt

# Extract all SQL statements from seed-data.sh (lines starting with exec_sql "..." and their quoted content)
awk '/^exec_sql "/{started=1; line=""; next} started && /"$;?$/{line=line $0; started=0; print line} started{print}' seed-data.sh | sed 's/^"//; s/"$//' | sed 's/",$//' > /tmp/seed_stmts.txt

while IFS= read -r stmt; do
  [ -z "$stmt" ] && continue
  echo "--- running: $(echo "$stmt" | cut -c1-60)..."
  echo "$stmt" > /tmp/one_stmt.sql
  npx wrangler d1 execute "$DB" --file /tmp/one_stmt.sql --remote > "$OUT" 2>&1
  if grep -q '"success": true' "$OUT" || grep -q 'success' "$OUT"; then
    ch=$(grep -oE '"changes":[0-9]+' "$OUT" | head -1)
    echo "    ok ($ch)"
  else
    echo "    FAILED:"
    grep -E "Error|error" "$OUT" | head -3
  fi
done < /tmp/seed_stmts.txt
echo "DONE"
