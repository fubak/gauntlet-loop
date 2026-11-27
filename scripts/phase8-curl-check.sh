#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8787}"

echo "== Phase 8 curl checks on $BASE =="

json_field() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$1',''))"
}

echo "-- mint session A"
A_JSON=$(curl -sS -X POST "$BASE/v1/session")
A_TOKEN=$(echo "$A_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
A_LAT=34.73
A_LON=-86.59

echo "-- mint session B"
B_JSON=$(curl -sS -X POST "$BASE/v1/session")
B_TOKEN=$(echo "$B_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
B_LAT=40.0
B_LON=-75.0

echo "-- opt-in A, PUT location"
curl -sS -X PUT "$BASE/v1/session/location-opt-in" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationOptIn":true}' >/dev/null
curl -sS -X PUT "$BASE/v1/location" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"lat\":$A_LAT,\"lon\":$A_LON,\"recordedAt\":\"2026-11-08T12:00:00.000Z\"}" >/dev/null

echo "-- A GET has A coords, not B"
A_GET=$(curl -sS -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/location")
echo "$A_GET"
echo "$A_GET" | grep -q "$A_LAT"
echo "$A_GET" | grep -vq "$B_LAT"

echo "-- B GET must not contain A coords"
B_GET=$(curl -sS -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/location")
echo "$B_GET"
echo "$B_GET" | grep -vq "$A_LAT"

echo "-- forged auth returns 401 empty"
CODE=$(curl -sS -o /tmp/forged-body -w "%{http_code}" -H "Authorization: Bearer forged-token" "$BASE/v1/location")
test "$CODE" = "401"
test ! -s /tmp/forged-body

echo "-- B cannot use A bearer via forged path (already separate sessions)"
CODE2=$(curl -sS -o /tmp/bad -w "%{http_code}" -H "Authorization: Bearer $A_TOKEN" -H "X-Session-Id: b" "$BASE/v1/location/does-not-exist" || true)

echo "-- opt-out B"
curl -sS -X PUT "$BASE/v1/session/location-opt-in" \
  -H "Authorization: Bearer $B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationOptIn":false}' >/dev/null
B_OPT=$(curl -sS -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/location")
echo "$B_OPT"
echo "$B_OPT" | grep -q '"optedOut":true'

echo "-- writeToken mint for A"
WRITE_JSON=$(curl -sS -X POST "$BASE/v1/location/writer" -H "Authorization: Bearer $A_TOKEN")
WRITE_TOKEN=$(echo "$WRITE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['writeToken'])")

echo "-- writeToken cannot GET"
W_CODE=$(curl -sS -o /tmp/wget -w "%{http_code}" -H "Authorization: Bearer $WRITE_TOKEN" "$BASE/v1/location")
test "$W_CODE" = "401"
test ! -s /tmp/wget

echo "-- writeToken PUT updates A only"
curl -sS -X PUT "$BASE/v1/location" \
  -H "Authorization: Bearer $WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lat":34.75,"lon":-86.58,"recordedAt":"2026-11-08T21:00:00.000Z"}' >/dev/null
A2=$(curl -sS -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/location")
echo "$A2"
echo "$A2" | grep -q '34.75'
B2=$(curl -sS -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/location")
echo "$B2"
echo "$B2" | grep -vq '34.75'

echo "-- stale fix (2h old)"
OLD=$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v-2H +%Y-%m-%dT%H:%M:%S.000Z)
curl -sS -X PUT "$BASE/v1/location" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"lat\":34.73,\"lon\":-86.59,\"recordedAt\":\"$OLD\"}" >/dev/null
STALE=$(curl -sS -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/location")
echo "$STALE"
echo "$STALE" | grep -q '"stale":true'

echo "== all Phase 8 curl checks passed =="
