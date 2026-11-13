/**
 * Optional sci-fi frame overlay. Off by default. Parked toggle only.
 */
(function cockpitModule() {
  "use strict";

  var STORAGE_KEY = "gauntlet-loop-cockpit-v1";

  /**
   * @param {{ getMode: () => string, modeParked: string, onResize?: () => void }} opts
   */
  function attachCockpit(opts) {
    var enabled = false;
    try {
      if (/(?:\?|&)cockpit=1(?:&|$)/.test(location.search)) {
        enabled = true;
      } else if (localStorage.getItem(STORAGE_KEY) === "1") {
        enabled = true;
      }
    } catch (e) {
      enabled = false;
    }

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "cockpit-toggle";
    toggle.textContent = "Cockpit off";
    toggle.style.display = "none";

    var bar = document.getElementById("mode-switch");
    if (bar) {
      bar.appendChild(toggle);
    } else {
      document.body.appendChild(toggle);
    }

    function syncToggleUi() {
      var parked = opts.getMode() === opts.modeParked;
      toggle.style.display = parked ? "inline-block" : "none";
      toggle.textContent = enabled ? "Cockpit on" : "Cockpit off";
      toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
    }

    toggle.addEventListener("click", function () {
      if (opts.getMode() !== opts.modeParked) {
        return;
      }
      enabled = !enabled;
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
      syncToggleUi();
      if (opts.onResize) {
        opts.onResize();
      }
    });

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} w css pixels
     * @param {number} h css pixels
     */
    function drawCockpitFrame(ctx, w, h) {
      if (!enabled) {
        return;
      }
      ctx.save();
      var pad = 14;
      ctx.strokeStyle = "rgba(94, 234, 212, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad, pad + 18);
      ctx.lineTo(pad, pad);
      ctx.lineTo(pad + 24, pad);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w - pad - 24, pad);
      ctx.lineTo(w - pad, pad);
      ctx.lineTo(w - pad, pad + 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, h - pad - 18);
      ctx.lineTo(pad, h - pad);
      ctx.lineTo(pad + 28, h - pad);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w - pad - 28, h - pad);
      ctx.lineTo(w - pad, h - pad);
      ctx.lineTo(w - pad, h - pad - 18);
      ctx.stroke();

      ctx.fillStyle = "rgba(94, 234, 212, 0.04)";
      var i;
      for (i = 0; i < h; i += 4) {
        ctx.fillRect(0, i, w, 1);
      }
      ctx.restore();
    }

    return {
      isEnabled: function () {
        return enabled;
      },
      setEnabled: function (on) {
        enabled = !!on;
        syncToggleUi();
      },
      toggle: function () {
        enabled = !enabled;
        syncToggleUi();
        return enabled;
      },
      syncToggleUi: syncToggleUi,
      drawCockpitFrame: drawCockpitFrame,
    };
  }

  var api = {
    attachCockpit: attachCockpit,
    STORAGE_KEY: STORAGE_KEY,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopCockpit = api;
  }
})();
