#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8787}"

echo "== Phase 9 curl checks on $BASE =="

A_JSON=$(curl -sS -X POST "$BASE/v1/session")
A_TOKEN=$(echo "$A_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
A_PID=$(echo "$A_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['publicId'])")

B_JSON=$(curl -sS -X POST "$BASE/v1/session")
B_TOKEN=$(echo "$B_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
B_PID=$(echo "$B_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['publicId'])")

post_presence() {
  local token="$1"
  local lane="$2"
  local score="$3"
  local extra="${4:-}"
  curl -sS -X POST "$BASE/v1/room/loop" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"presence\":{\"lane\":$lane,\"shipY\":82,\"score\":$score,\"fireFlash\":false$extra}}"
}

echo "-- A and B join with scores"
post_presence "$A_TOKEN" 44 100
post_presence "$B_TOKEN" 60 250

ROOM=$(curl -sS -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/room/loop")
echo "$ROOM"
echo "$ROOM" | grep -q "$A_PID"
echo "$ROOM" | grep -q "$B_PID"
echo "$ROOM" | grep -vq '"lat"'
echo "$ROOM" | grep -vq '"token"'

echo "-- opted-out B still a ship (no location opt-in required)"
echo "$ROOM" | grep -q "$B_PID"

echo "-- strip lat on server"
EVIL=$(curl -sS -X POST "$BASE/v1/room/loop" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"presence":{"lane":50,"shipY":82,"score":1,"lat":33.5,"lon":-86.5,"sessionId":"leak","token":"bad"}}')
echo "$EVIL" | grep -vq '"lat"'
echo "$EVIL" | grep -vq '"sessionId"'

echo "-- writeToken cannot join room"
curl -sS -X PUT "$BASE/v1/session/location-opt-in" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationOptIn":true}' >/dev/null
WRITE_JSON=$(curl -sS -X POST "$BASE/v1/location/writer" -H "Authorization: Bearer $A_TOKEN")
WRITE_TOKEN=$(echo "$WRITE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['writeToken'])")
W_CODE=$(curl -sS -o /tmp/wroom -w "%{http_code}" -H "Authorization: Bearer $WRITE_TOKEN" "$BASE/v1/room/loop")
test "$W_CODE" = "401"
test ! -s /tmp/wroom

echo "-- disconnect B removes ship"
curl -sS -X DELETE -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/room/loop" >/dev/null
sleep 1
AFTER=$(curl -sS -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/room/loop")
echo "$AFTER"
echo "$AFTER" | grep -vq "$B_PID"

echo "== all Phase 9 curl checks passed =="
