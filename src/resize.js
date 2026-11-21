/**
 * Canvas CSS size vs backing store with DPR cap.
 */
(function resizeModule() {
  "use strict";

  var DPR_CAP = 2.0;

  /**
   * @typedef {{
   *   cssWidth: number,
   *   cssHeight: number,
   *   dpr: number,
   *   worldScale: number,
   *   worldWidth: number,
   *   worldHeight: number,
   *   offsetX: number,
   *   offsetY: number
   * }} Viewport
   */

  /**
   * @param {number} worldWidth
   * @param {number} worldHeight
   * @returns {Viewport}
   */
  function createViewport(worldWidth, worldHeight) {
    return {
      cssWidth: 0,
      cssHeight: 0,
      dpr: 1,
      worldScale: 1,
      worldWidth: worldWidth,
      worldHeight: worldHeight,
      offsetX: 0,
      offsetY: 0,
    };
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Viewport} viewport
   * @param {CanvasRenderingContext2D} ctx
   */
  function applyResize(canvas, viewport, ctx) {
    var vv = window.visualViewport;
    var cssW = vv ? vv.width : window.innerWidth;
    var cssH = vv ? vv.height : window.innerHeight;
    var dpr = window.devicePixelRatio || 1;
    if (dpr > DPR_CAP) {
      dpr = DPR_CAP;
    }

    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));

    var scaleW = cssW / viewport.worldWidth;
    var scaleH = cssH / viewport.worldHeight;
    var worldScale = scaleW < scaleH ? scaleW : scaleH;

    viewport.cssWidth = cssW;
    viewport.cssHeight = cssH;
    viewport.dpr = dpr;
    viewport.worldScale = worldScale;
    viewport.offsetX = (cssW - viewport.worldWidth * worldScale) * 0.5;
    viewport.offsetY = (cssH - viewport.worldHeight * worldScale) * 0.5;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * @param {Viewport} viewport
   * @param {number} worldX
   * @param {number} worldY
   * @returns {{ x: number, y: number }}
   */
  function worldToCss(viewport, worldX, worldY) {
    return {
      x: viewport.offsetX + worldX * viewport.worldScale,
      y: viewport.offsetY + worldY * viewport.worldScale,
    };
  }

  var api = {
    DPR_CAP: DPR_CAP,
    createViewport: createViewport,
    applyResize: applyResize,
    worldToCss: worldToCss,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopResize = api;
  }
})();
