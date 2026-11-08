/**
 * Draw highway and player from sim state. No input ownership.
 */
(function renderModule() {
  "use strict";

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import("./sim.js").SimState} sim
   * @param {import("./resize.js").Viewport} viewport
   */
  function drawFrame(ctx, sim, viewport) {
    var w = viewport.cssWidth;
    var h = viewport.cssHeight;
    var s = viewport.worldScale;
    var ox = viewport.offsetX;
    var oy = viewport.offsetY;
    var ww = sim.worldWidth;
    var wh = sim.worldHeight;

    ctx.save();
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    ctx.fillStyle = "#2a2f38";
    ctx.fillRect(0, 0, ww, wh);

    ctx.fillStyle = "#1e242d";
    ctx.fillRect(8, 0, 14, wh);
    ctx.fillRect(ww - 22, 0, 14, wh);

    ctx.fillStyle = "#3d4450";
    ctx.fillRect(22, 0, ww - 44, wh);

    drawRoadMarks(ctx, sim, ww, wh);

    drawPlayer(ctx, sim);

    ctx.restore();
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import("./sim.js").SimState} sim
   * @param {number} ww
   * @param {number} wh
   */
  function drawRoadMarks(ctx, sim, ww, wh) {
    var laneX = ww * 0.5;
    var segment = 8;
    var offset = sim.roadScroll % segment;
    ctx.strokeStyle = "#d8dde6";
    ctx.lineWidth = 0.35;
    ctx.setLineDash([2.2, 2.2]);
    var y = -offset;
    while (y < wh + segment) {
      ctx.beginPath();
      ctx.moveTo(laneX, y);
      ctx.lineTo(laneX, y + 2.2);
      ctx.stroke();
      y += segment;
    }
    ctx.setLineDash([]);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import("./sim.js").SimState} sim
   */
  function drawPlayer(ctx, sim) {
    var x = sim.playerX;
    var y = sim.playerY;
    var size = 3.2;
    ctx.fillStyle = "#5eead4";
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size * 0.65, y - size * 0.4);
    ctx.lineTo(x + size * 0.65, y - size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 0.2;
    ctx.stroke();
  }

  var api = {
    drawFrame: drawFrame,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopRender = api;
  }
})();
