/**
 * Thin wiring for Phase 2 highway stub. No game rules here.
 */
(function mainModule() {
  "use strict";

  function isProbeUrl() {
    if (typeof location === "undefined") {
      return false;
    }
    return /(?:\?|&)probe=1(?:&|$)/.test(location.search);
  }

  function bootGame() {
    var command = globalThis.GauntletLoopCommand;
    var mode = globalThis.GauntletLoopMode;
    var simApi = globalThis.GauntletLoopSim;
    var render = globalThis.GauntletLoopRender;
    var resize = globalThis.GauntletLoopResize;
    var inputKb = globalThis.GauntletLoopInputKeyboard;
    var loop = globalThis.GauntletLoopLoop;

    if (!command || !mode || !simApi || !render || !resize || !inputKb || !loop) {
      return;
    }

    var probeRoot = document.getElementById("probe-root");
    if (probeRoot) {
      probeRoot.style.display = "none";
    }

    var canvas = document.getElementById("game");
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      return;
    }
    canvas.style.display = "block";

    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    var queue = command.createQueue();
    var modeState = mode.createModeState();
    mode.setSessionMode(modeState, mode.MODE_PARKED);

    /** @type {{ steer: number, source: string | null }} */
    var control = { steer: 0, source: null };

    var sim = simApi.createSim();
    var viewport = resize.createViewport(sim.worldWidth, sim.worldHeight);

    function getMode() {
      return modeState.mode;
    }

    inputKb.attachKeyboard(control, getMode, mode);

    function handleResize() {
      resize.applyResize(canvas, viewport, ctx);
    }

    window.addEventListener("resize", handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }
    handleResize();

    loop.startGameLoop({
      onTick: function (dt) {
        var cmds = command.drainForTick(queue);
        var i;
        for (i = 0; i < cmds.length; i++) {
          mode.filterCommand(cmds[i], modeState.mode);
        }
        simApi.step(sim, dt, control.steer);
      },
      onFrame: function () {
        render.drawFrame(ctx, sim, viewport);
      },
    });

    globalThis.GauntletLoopGame = {
      getSim: function () {
        return { playerX: sim.playerX, playerY: sim.playerY };
      },
      getViewport: function () {
        return {
          cssWidth: viewport.cssWidth,
          cssHeight: viewport.cssHeight,
          dpr: viewport.dpr,
          worldScale: viewport.worldScale,
        };
      },
      getControl: function () {
        return { steer: control.steer, source: control.source };
      },
    };
  }

  function boot() {
    if (isProbeUrl()) {
      return;
    }
    bootGame();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
