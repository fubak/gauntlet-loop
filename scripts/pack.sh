#!/usr/bin/env bash
# Concatenate client modules into one HTML file for Tesla and desktop.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/index.html"
SRC_PROBE="$ROOT/src/probe.js"
PACK_LIBS=(
  "$ROOT/src/command.js"
  "$ROOT/src/mode.js"
  "$ROOT/src/parse-intent.js"
)

mkdir -p "$ROOT/dist"

if [[ ! -f "$SRC_PROBE" ]]; then
  echo "Missing $SRC_PROBE" >&2
  exit 1
fi

LIBS_JS=""
for lib in "${PACK_LIBS[@]}"; do
  if [[ -f "$lib" ]]; then
    LIBS_JS+="$(cat "$lib")"$'\n'
  fi
done

PROBE_JS="$(cat "$SRC_PROBE")"
PACKED_JS="${LIBS_JS}${PROBE_JS}"

cat >"$OUT" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Gauntlet Loop | capability probe</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: system-ui, sans-serif;
      background: #0d1117;
      color: #e6edf3;
    }
    body {
      margin: 0;
      padding: 1rem 1.25rem 2rem;
      line-height: 1.4;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
    }
    .probe-note {
      margin: 0 0 1rem;
      color: #8b949e;
      font-size: 0.9rem;
    }
    .probe-table {
      width: 100%;
      max-width: 42rem;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    .probe-table th,
    .probe-table td {
      border: 1px solid #30363d;
      padding: 0.5rem 0.65rem;
      text-align: left;
      vertical-align: top;
    }
    .probe-table th {
      background: #161b22;
    }
    .probe-table td.pass {
      color: #3fb950;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.8rem;
    }
    .probe-table td.fail {
      color: #f85149;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.8rem;
    }
    .probe-table td.detail {
      color: #c9d1d9;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div id="probe-root" aria-live="polite"></div>
  <script>
${PACKED_JS}
  </script>
</body>
</html>
EOF

echo "Wrote $OUT"
