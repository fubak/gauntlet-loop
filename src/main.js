/**
 * Thin wiring: inputs, queue, mode filter, combat, sim, render.
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
    var parseIntent = globalThis.GauntletLoopParseIntent;
    var simApi = globalThis.GauntletLoopSim;
    var render = globalThis.GauntletLoopRender;
    var resize = globalThis.GauntletLoopResize;
    var inputKb = globalThis.GauntletLoopInputKeyboard;
    var inputTyped = globalThis.GauntletLoopInputTyped;
    var inputGamepad = globalThis.GauntletLoopInputGamepad;
    var inputTouch = globalThis.GauntletLoopInputTouch;
    var combatApi = globalThis.GauntletLoopCombat;
    var loop = globalThis.GauntletLoopLoop;

    if (
      !command ||
      !mode ||
      !parseIntent ||
      !simApi ||
      !render ||
      !resize ||
      !inputKb ||
      !inputTyped ||
      !inputGamepad ||
      !inputTouch ||
      !combatApi ||
      !loop
    ) {
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
    var combat = combatApi.createCombat();
    var viewport = resize.createViewport(sim.worldWidth, sim.worldHeight);

    function getMode() {
      return modeState.mode;
    }

    function enqueueParsed(cmds) {
      var i;
      for (i = 0; i < cmds.length; i++) {
        command.enqueue(queue, cmds[i]);
      }
    }

    var touch = null;
    touch = inputTouch.attachTouch(control, getMode, mode, mode, command, queue);

    var pad = inputGamepad.attachGamepad(control, getMode, mode, command, queue, {
      onConnected: function () {
        if (touch) {
          touch.hide();
        }
      },
    });

    var kb = inputKb.attachKeyboard(control, getMode, mode, command, queue, {
      onGameplayKey: function () {
        if (touch) {
          touch.hide();
        }
      },
    });

    var typed = inputTyped.attachTypedInput({
      parseIntent: parseIntent.parseIntent,
      onCommands: enqueueParsed,
    });

    function runTick(dt) {
      pad.poll();
      var cmds = command.drainForTick(queue);
      var i;
      for (i = 0; i < cmds.length; i++) {
        var allowed = mode.filterCommand(cmds[i], modeState.mode);
        if (allowed) {
          combatApi.handleCommand(combat, sim, allowed);
        }
      }
      simApi.step(sim, dt, control.steer);
      combatApi.step(combat, sim, dt);
    }

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
        runTick(dt);
      },
      onFrame: function () {
        if (touch) {
          touch.syncDisplay();
        }
        render.drawFrame(ctx, sim, viewport, combat);
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
      getCombat: function () {
        return {
          lockEnemyId: combat.lockEnemyId,
          lockColor: combat.lockColor,
          lastHitEnemyId: combat.lastHitEnemyId,
          score: combat.score,
          weaponCooldown: combat.weaponCooldown,
          specialCooldown: combat.specialCooldown,
          enemyCount: combat.enemies.length,
          enemies: combat.enemies.map(function (e) {
            return {
              id: e.id,
              x: e.x,
              y: e.y,
              color: e.color,
              alive: e.alive,
            };
          }),
        };
      },
      isTouchVisible: function () {
        return touch ? touch.isVisible() : false;
      },
      showTouchOverlay: function () {
        if (touch) {
          touch.show();
        }
      },
      placeTestEnemies: function (specs) {
        combatApi.placeTestEnemies(combat, sim, specs);
      },
      submitTyped: function (text) {
        return typed.submitText(text);
      },
      applyFirstTypedCommand: function (text) {
        var cmds = parseIntent.parseIntent(text);
        if (cmds.length === 0) {
          return null;
        }
        command.enqueue(queue, cmds[0]);
        var drained = command.drainForTick(queue);
        if (drained.length) {
          var allowed = mode.filterCommand(drained[0], modeState.mode);
          if (allowed) {
            combatApi.handleCommand(combat, sim, allowed);
          }
        }
        return combat.lockEnemyId;
      },
      tickSeconds: function (seconds) {
        var slice = 1 / 60;
        var left = seconds;
        while (left > 0) {
          var dt = left < slice ? left : slice;
          left -= dt;
          runTick(dt);
        }
      },
      pressFire: function () {
        kb.pressFire();
      },
      pressSpecial: function () {
        kb.pressSpecial();
      },
      injectGamepadSteer: function (axisX) {
        pad.injectTestGamepad({ axes: [axisX, 0], buttons: [] });
        if (touch) {
          touch.hide();
        }
        pad.poll();
      },
      simulateGamepadDisconnect: function () {
        pad.simulateDisconnect();
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
