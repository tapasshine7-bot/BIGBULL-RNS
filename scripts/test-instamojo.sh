#!/usr/bin/env bash
set -u
source /tmp/instamojo_secrets.sh
echo "=== list payment requests (GET /payment-requests) ==="
curl -s -w '\nHTTP %{http_code}\n' "https://api.instamojo.com/v2/payment-requests/" \
  -H "X-Api-Key: $INSTAMOJO_API_KEY" -H "X-Auth-Token: $INSTAMOJO_AUTH_TOKEN" | head -c 600
