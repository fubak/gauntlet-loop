/**
 * Draw highway, enemies, loot, lock marker, and player.
 */
(function renderModule() {
  "use strict";

  var COLOR_FILL = {
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#22c55e",
  };

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import("./sim.js").SimState} sim
   * @param {import("./resize.js").Viewport} viewport
   * @param {import("./combat.js").CombatState} combat
   */
  function drawFrame(ctx, sim, viewport, combat) {
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

    var now = performance.now() / 1000;
    if (combat && combat.specialFlashUntil > now) {
      ctx.strokeStyle = "rgba(94, 234, 212, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sim.playerX, sim.playerY, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (combat) {
      var i;
      for (i = 0; i < combat.loot.length; i++) {
        drawLoot(ctx, combat.loot[i]);
      }
      for (i = 0; i < combat.enemies.length; i++) {
        var enemy = combat.enemies[i];
        if (!enemy.alive) {
          continue;
        }
        drawEnemy(ctx, enemy);
        if (combat.lockEnemyId === enemy.id) {
          drawLockMarker(ctx, enemy);
        }
      }
    }

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
   * @param {{ x: number, y: number, color: string, mark: string }} enemy
   */
  function drawEnemy(ctx, enemy) {
    var x = enemy.x;
    var y = enemy.y;
    var r = 2.4;
    ctx.fillStyle = COLOR_FILL[enemy.color] || "#888";
    ctx.beginPath();
    ctx.rect(x - r, y - r, r * 2, r * 2);
    ctx.fill();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 0.25;
    ctx.stroke();
    drawMark(ctx, enemy);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number, mark: string }} enemy
   */
  function drawMark(ctx, enemy) {
    var x = enemy.x;
    var y = enemy.y;
    ctx.strokeStyle = "#f8fafc";
    ctx.fillStyle = "#f8fafc";
    ctx.lineWidth = 0.3;
    if (enemy.mark === "chevron") {
      ctx.beginPath();
      ctx.moveTo(x, y - 1.1);
      ctx.lineTo(x - 0.9, y + 0.2);
      ctx.lineTo(x + 0.9, y + 0.2);
      ctx.closePath();
      ctx.stroke();
    } else if (enemy.mark === "stripe") {
      ctx.beginPath();
      ctx.moveTo(x - 0.9, y - 0.2);
      ctx.lineTo(x + 0.9, y + 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 0.9, y + 0.4);
      ctx.lineTo(x + 0.9, y + 0.8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - 0.9);
      ctx.lineTo(x + 0.9, y);
      ctx.lineTo(x, y + 0.9);
      ctx.lineTo(x - 0.9, y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} enemy
   */
  function drawLockMarker(ctx, enemy) {
    var x = enemy.x;
    var y = enemy.y;
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(x, y, 3.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 4.8);
    ctx.lineTo(x, y - 6.2);
    ctx.stroke();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number }} loot
   */
  function drawLoot(ctx, loot) {
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(loot.x, loot.y, 0.9, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.65, y + size * 0.4);
    ctx.lineTo(x + size * 0.65, y + size * 0.4);
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
