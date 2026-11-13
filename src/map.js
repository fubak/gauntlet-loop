/**
 * Owner-only progress map: dot, region label, age string.
 */
(function mapModule() {
  "use strict";

  /**
   * @typedef {{ lat: number | null, lon: number | null, recordedAt: string | null, stale: boolean, ok: boolean, optedOut: boolean, error: string | null }} LocationFix
   */

  /**
   * @param {string | null} recordedAt
   * @returns {string}
   */
  function formatAge(recordedAt) {
    if (!recordedAt) {
      return "age unknown";
    }
    var ms = Date.parse(recordedAt);
    if (Number.isNaN(ms)) {
      return "age unknown";
    }
    var mins = Math.floor((Date.now() - ms) / 60000);
    if (mins < 1) {
      return "just now";
    }
    if (mins === 1) {
      return "1 min ago";
    }
    return mins + " min ago";
  }

  /**
   * @param {LocationFix} fix
   * @param {{ label: string }} flavor
   * @returns {{ headline: string, age: string, dotX: number, dotY: number, showDot: boolean }}
   */
  function mapLayout(fix, flavor) {
    if (fix.optedOut) {
      return {
        headline: "location off",
        age: "",
        dotX: 0.5,
        dotY: 0.55,
        showDot: false,
      };
    }
    if (!fix.ok || fix.lat === null || fix.lon === null) {
      return {
        headline: "location unknown",
        age: "",
        dotX: 0.5,
        dotY: 0.55,
        showDot: false,
      };
    }
    var age = formatAge(fix.recordedAt);
    if (fix.stale) {
      age = age + " (stale)";
    }
    if (fix.error) {
      age = age + " (fetch error)";
    }
    return {
      headline: flavor.label,
      age: age,
      dotX: 0.5,
      dotY: 0.42,
      showDot: true,
    };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {LocationFix} fix
   * @param {{ label: string, accent: string }} flavor
   */
  function drawOwnerMap(ctx, w, h, fix, flavor) {
    var pad = 10;
    var boxW = Math.min(168, w * 0.38);
    var boxH = 72;
    var x = w - boxW - pad;
    var y = pad + 36;

    var layout = mapLayout(fix, flavor);

    ctx.save();
    ctx.fillStyle = "rgba(13, 17, 23, 0.88)";
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#c9d1d9";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Your map", x + 8, y + 6);

    ctx.fillStyle = "#e6edf3";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(layout.headline, x + 8, y + 22);

    if (layout.age) {
      ctx.fillStyle = fix.stale ? "#fbbf24" : "#8b949e";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(layout.age, x + 8, y + 38);
    }

    if (layout.showDot) {
      var dotPx = x + boxW * layout.dotX;
      var dotPy = y + boxH * layout.dotY;
      ctx.fillStyle = flavor.accent || "#5eead4";
      ctx.beginPath();
      ctx.arc(dotPx, dotPy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  var api = {
    formatAge: formatAge,
    mapLayout: mapLayout,
    drawOwnerMap: drawOwnerMap,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopMap = api;
  }
})();
