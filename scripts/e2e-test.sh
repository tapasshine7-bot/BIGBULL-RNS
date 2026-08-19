#!/usr/bin/env bash
# Full E2E verification of the deployed bigbull-rns-api Worker.
set -u
BASE="https://bigbull-rns-api.tapasshine7.workers.dev"
ORIGIN="https://rnsbigbull.site"
U="$(date +%s)"
jar="/tmp/cookies_$U"

pass=0; fail=0
check() { local label="$1"; local got="$2"; local expected="$3";
  if [ "$got" = "$expected" ]; then echo "PASS  $label ($got)"; pass=$((pass+1));
  else echo "FAIL  $label (expected $expected, got $got)"; fail=$((fail+1)); fi; }

echo "=== 1. healthz ==="
out=$(curl -s -w '\n%{http_code}' "$BASE/api/healthz")
code=${out##*$'\n'}; body=${out%$'\n'*}
check healthz "$code" 200; echo "$body"

echo "=== 2. anonymous gateway gate ==="
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/gateway" -H "Origin: $ORIGIN")
check anon-gate "$code" 401

echo "=== 3. signup ==="
out=$(curl -s -i -X POST "$BASE/api/auth/signup" -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  -d "{\"username\":\"e2e_$U\",\"password\":\"E2eSecurePass123!\",\"confirmPassword\":\"E2eSecurePass123!\"}")
code=$(echo "$out" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')
check signup "$code" 200

echo "=== 4. login ==="
out=$(curl -s -i -c "$jar" -X POST "$BASE/api/auth/login" -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  -d "{\"username\":\"e2e_$U\",\"password\":\"E2eSecurePass123!\"}")
code=$(echo "$out" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')
check login "$code" 200

echo "=== 5. wrong password denial ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  -d "{\"username\":\"e2e_$U\",\"password\":\"wrongpassword\"}")
check wrong-pass "$code" 401

echo "=== 6. gateway with session ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$jar" "$BASE/api/gateway" -H "Origin: $ORIGIN")
check gateway "$code" 200

echo "=== 7. vip/status (should be locked) ==="
out=$(curl -s -b "$jar" "$BASE/api/vip/status" -H "Origin: $ORIGIN")
check vip-status-locked "$(echo "$out" | python3 -c "import sys,json;print('locked' if json.load(sys.stdin)['vipAccess'] is False else 'OPEN')" 2>/dev/null)" locked
echo "$out"

echo "=== 8. vip/payment -> Instamojo URL ==="
out=$(curl -s -b "$jar" -X POST "$BASE/api/vip/payment" -H "Origin: $ORIGIN")
check vip-payment "$(echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);print('200' if 'paymentUrl' in d else 'ERR:'+str(d))" 2>/dev/null)" 200
echo "$out"

echo "=== 9. activity ledger ==="
out=$(curl -s -b "$jar" "$BASE/api/activity" -H "Origin: $ORIGIN")
check activity "$(echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);print('rows' if len(d.get('entries',d))>0 else 'NONE')" 2>/dev/null)" rows
echo "$out" | head -c 300

echo "=== 10. fake webhook with bad MAC ==="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/webhook/instamojo" -H "Origin: $ORIGIN" \
  -d "payment_request_id=pr_test&mac=badmac&amount=20&currency=INR&status=Credit&payment_id=pay_test")
check webhook-bad-mac "$code" 400

echo "=== SUMMARY: passed=$pass failed=$fail ==="
rm -f "$jar"
