/**
 * Thin wiring: UI, inputs, queue, mode filter, combat, sim, render.
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
    var inputVoice = globalThis.GauntletLoopInputVoice;
    var combatApi = globalThis.GauntletLoopCombat;
    var loop = globalThis.GauntletLoopLoop;
    var uiApi = globalThis.GauntletLoopUi;

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
      !inputVoice ||
      !combatApi ||
      !loop ||
      !uiApi
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

    /** @type {{ steer: number, source: string | null }} */
    var control = { steer: 0, source: null };

    /** @type {{ locationOptIn: boolean, physicalKeyboardSeen: boolean }} */
    var session = {
      locationOptIn: false,
      physicalKeyboardSeen: false,
    };

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

    function enqueueVoice(cmds) {
      var i;
      for (i = 0; i < cmds.length; i++) {
        command.enqueue(queue, cmds[i]);
      }
    }

    var touch = inputTouch.attachTouch(control, getMode, mode, mode, command, queue);
    var pad = inputGamepad.attachGamepad(control, getMode, mode, command, queue, {
      onConnected: function () {
        if (getMode() === mode.MODE_PARKED) {
          touch.hide();
        }
      },
    });

    var typed = inputTyped.attachTypedInput({
      parseIntent: parseIntent.parseIntent,
      onCommands: enqueueParsed,
    });

    var voice = inputVoice.attachVoiceInput({
      parseIntent: parseIntent.parseIntent,
      onVoiceCommands: enqueueVoice,
      getMode: getMode,
      modeBoot: mode.MODE_BOOT,
    });

    function syncInputLayers() {
      var m = getMode();
      if (m === mode.MODE_BOOT) {
        typed.setVisible(false);
        touch.hide();
        control.steer = 0;
        control.source = null;
        voice.syncForMode();
        return;
      }
      if (m === mode.MODE_MOTION) {
        touch.hide();
        control.steer = 0;
        control.source = null;
        if (session.physicalKeyboardSeen) {
          typed.setVisible(true);
        } else {
          typed.setVisible(false);
        }
      } else {
        typed.setVisible(true);
        touch.show();
      }
      voice.syncForMode();
    }

    var kb = inputKb.attachKeyboard(control, getMode, mode, command, queue, {
      onGameplayKey: function () {
        session.physicalKeyboardSeen = true;
        if (getMode() === mode.MODE_PARKED) {
          touch.hide();
        }
        syncInputLayers();
      },
    });

    function applyLocationFlag(optIn) {
      session.locationOptIn = !!optIn;
    }

    var ui = null;

    function enterParked(locationOptIn) {
      applyLocationFlag(locationOptIn);
      mode.setSessionMode(modeState, mode.MODE_PARKED);
      syncInputLayers();
      if (ui) {
        ui.syncSwitchUi();
      }
    }

    function enterMotion(locationOptIn) {
      applyLocationFlag(locationOptIn);
      mode.setSessionMode(modeState, mode.MODE_MOTION);
      syncInputLayers();
      if (ui) {
        ui.syncSwitchUi();
      }
    }

    ui = uiApi.attachBootUi({
      getMode: getMode,
      onChooseParked: function (loc) {
        enterParked(loc);
      },
      onChooseMotion: function (loc) {
        enterMotion(loc);
      },
      onSwitchParked: function () {
        enterParked(session.locationOptIn);
      },
      onSwitchMotion: function () {
        enterMotion(session.locationOptIn);
      },
    });

    syncInputLayers();

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
        touch.syncDisplay();
        render.drawFrame(ctx, sim, viewport, combat);
      },
    });

    globalThis.GauntletLoopGame = {
      getMode: function () {
        return getMode();
      },
      getSession: function () {
        return {
          locationOptIn: session.locationOptIn,
          physicalKeyboardSeen: session.physicalKeyboardSeen,
        };
      },
      chooseParked: function (locationOptIn) {
        enterParked(!!locationOptIn);
      },
      chooseVoiceOnly: function (locationOptIn) {
        enterMotion(!!locationOptIn);
      },
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
        return touch.isVisible();
      },
      isTypedVisible: function () {
        return typed.wrapElement.style.display !== "none";
      },
      placeTestEnemies: function (specs) {
        combatApi.placeTestEnemies(combat, sim, specs);
      },
      submitTyped: function (text) {
        return typed.submitText(text);
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
        if (getMode() === mode.MODE_PARKED) {
          touch.hide();
        }
        pad.poll();
      },
      injectGamepadFire: function () {
        pad.injectTestGamepad({ axes: [0, 0], buttons: [true] });
        pad.poll();
        pad.injectTestGamepad({ axes: [0, 0], buttons: [true] });
        pad.poll();
      },
      simulateGamepadDisconnect: function () {
        pad.simulateDisconnect();
      },
      getVoice: function () {
        return {
          available: voice.isAvailable(),
          hud: voice.getHudText(),
          listening: voice.isListening(),
          listenVisible: voice.isListenVisible(),
        };
      },
      simulateListenGesture: function () {
        return voice.simulateListenGesture();
      },
      deliverVoiceTranscript: function (text) {
        return voice.deliverFinalTranscript(text);
      },
      forceVoiceUnavailable: function () {
        voice.forcePlatformUnavailable();
        voice.syncForMode();
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
