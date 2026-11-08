#!/usr/bin/env bash
# Concatenate client modules into one HTML file for Tesla and desktop.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/index.html"
PACK_MODULES=(
  "$ROOT/src/command.js"
  "$ROOT/src/mode.js"
  "$ROOT/src/parse-intent.js"
  "$ROOT/src/sim.js"
  "$ROOT/src/combat.js"
  "$ROOT/src/render.js"
  "$ROOT/src/resize.js"
  "$ROOT/src/input-keyboard.js"
  "$ROOT/src/input-typed.js"
  "$ROOT/src/loop.js"
  "$ROOT/src/main.js"
  "$ROOT/src/probe.js"
)

mkdir -p "$ROOT/dist"

PACKED_JS=""
for mod in "${PACK_MODULES[@]}"; do
  if [[ ! -f "$mod" ]]; then
    echo "Missing $mod" >&2
    exit 1
  fi
  PACKED_JS+="$(cat "$mod")"$'\n'
done

cat >"$OUT" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Gauntlet Loop</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: system-ui, sans-serif;
      background: #0d1117;
      color: #e6edf3;
    }
  html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    #game {
      display: none;
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      touch-action: none;
    }
    #probe-root {
      display: none;
      padding: 1rem 1.25rem 2rem;
      line-height: 1.4;
      overflow: auto;
      height: 100%;
    }
    #typed-input-wrap {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      gap: 0.5rem;
      padding: 0.6rem 0.75rem;
      background: rgba(13, 17, 23, 0.92);
      border-top: 1px solid #30363d;
      z-index: 5;
    }
    #typed-command {
      flex: 1;
      font-size: 1rem;
      padding: 0.5rem 0.65rem;
      border-radius: 6px;
      border: 1px solid #30363d;
      background: #0d1117;
      color: #e6edf3;
    }
    #typed-input-wrap button {
      font-size: 0.95rem;
      padding: 0.5rem 0.85rem;
      border-radius: 6px;
      border: 1px solid #30363d;
      background: #21262d;
      color: #e6edf3;
      cursor: pointer;
    }
    #probe-root h1 {
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
  <canvas id="game" aria-label="Highway playfield"></canvas>
  <div id="probe-root" aria-live="polite"></div>
  <script>
${PACKED_JS}
  </script>
</body>
</html>
EOF

echo "Wrote $OUT"
