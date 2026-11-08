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
  "$ROOT/src/input-gamepad.js"
  "$ROOT/src/input-touch.js"
  "$ROOT/src/input-typed.js"
  "$ROOT/src/loop.js"
  "$ROOT/src/ui.js"
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
    #touch-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      pointer-events: none;
      z-index: 4;
    }
    #touch-overlay .touch-steer,
    #touch-overlay .touch-actions,
    #touch-overlay button {
      pointer-events: auto;
    }
    #touch-overlay .touch-steer {
      width: 42vmin;
      max-width: 280px;
      margin: 12vh 0 10vh 0.75rem;
      border: 3px solid #e6edf3;
      border-radius: 18px;
      background: rgba(33, 38, 45, 0.75);
      touch-action: none;
    }
    #touch-overlay .touch-actions {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 0.75rem;
      margin: 12vh 0.75rem 10vh 0;
    }
    #touch-overlay button {
      min-width: 120px;
      min-height: 64px;
      font-size: 1.1rem;
      font-weight: 600;
      border-radius: 14px;
      border: 3px solid #e6edf3;
      background: rgba(33, 38, 45, 0.9);
      color: #e6edf3;
    }
    #touch-overlay .touch-fire {
      background: rgba(185, 28, 28, 0.85);
    }
    #touch-overlay .touch-special {
      background: rgba(37, 99, 235, 0.85);
    }
    #boot-overlay {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem;
      background: rgba(10, 14, 20, 0.94);
      text-align: center;
    }
    #boot-overlay h2 {
      margin: 0;
      font-size: 1.35rem;
    }
    .boot-warn {
      max-width: 28rem;
      margin: 0;
      color: #fbbf24;
      font-size: 0.95rem;
    }
    .boot-detail {
      max-width: 28rem;
      margin: 0;
      color: #c9d1d9;
      font-size: 0.9rem;
    }
    .boot-location {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: #e6edf3;
    }
    .boot-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
    }
    .boot-actions button {
      min-width: 140px;
      min-height: 48px;
      font-size: 1rem;
      padding: 0.55rem 1rem;
      border-radius: 10px;
      border: 2px solid #e6edf3;
      background: #21262d;
      color: #e6edf3;
      cursor: pointer;
    }
    #boot-parked {
      background: #0f766e;
    }
    #mode-switch {
      position: fixed;
      top: 0.5rem;
      right: 0.5rem;
      z-index: 6;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.5rem;
      background: rgba(13, 17, 23, 0.9);
      border: 1px solid #30363d;
      border-radius: 8px;
      font-size: 0.8rem;
    }
    #mode-switch button {
      padding: 0.25rem 0.45rem;
      border-radius: 6px;
      border: 1px solid #30363d;
      background: #21262d;
      color: #e6edf3;
      cursor: pointer;
    }
    #mode-switch button:disabled {
      opacity: 0.5;
      cursor: default;
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
