/**
 * Gamepad poll: remap table, steer axis, fire/special edges, disconnect zero steer.
 */
(function inputGamepadModule() {
  "use strict";

  var DEADZONE = 0.2;

  /** @type {{ steerAxis: number, steerAltAxis: number, dpadLeft: number, dpadRight: number, fire: number, specialPrimary: number, specialAlt: number }} */
  var REMAP = {
    steerAxis: 0,
    steerAltAxis: 2,
    dpadLeft: 14,
    dpadRight: 15,
    fire: 0,
    specialPrimary: 1,
    specialAlt: 4,
  };

  /**
   * @returns {{
   *   slotIndex: number | null,
   *   prevButtons: boolean[],
   *   injectPad: Gamepad | null,
   *   disconnectSteerActive: boolean
   * }}
   */
  function createGamepadState() {
    return {
      slotIndex: null,
      prevButtons: [],
      injectPad: null,
      disconnectSteerActive: false,
    };
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  function applyDeadzone(value) {
    if (value > DEADZONE) {
      return value;
    }
    if (value < -DEADZONE) {
      return value;
    }
    return 0;
  }

  /**
   * @param {Gamepad | null} pad
   * @returns {number}
   */
  function readSteerAxis(pad) {
    if (!pad) {
      return 0;
    }
    var raw = 0;
    if (pad.axes.length > REMAP.steerAxis) {
      raw = pad.axes[REMAP.steerAxis];
    }
    if (Math.abs(raw) < DEADZONE && pad.axes.length > REMAP.steerAltAxis) {
      raw = pad.axes[REMAP.steerAltAxis];
    }
    var steer = applyDeadzone(raw);
    if (steer !== 0) {
      return steer;
    }
    if (pad.buttons[REMAP.dpadLeft] && pad.buttons[REMAP.dpadLeft].pressed) {
      return -1;
    }
    if (pad.buttons[REMAP.dpadRight] && pad.buttons[REMAP.dpadRight].pressed) {
      return 1;
    }
    return 0;
  }

  /**
   * @param {object} state
   * @returns {Gamepad | null}
   */
  function activePad(state) {
    if (state.injectPad) {
      return state.injectPad;
    }
    if (state.slotIndex === null) {
      return null;
    }
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!pads || !pads[state.slotIndex]) {
      return null;
    }
    return pads[state.slotIndex];
  }

  /**
   * @param {{ steer: number, source: string | null }} control
   * @param {() => string} getMode
   * @param {{ filterSteer: function(number, string|null, string): number }} modeApi
   * @param {{ enqueue: function(object, object): object }} commandApi
   * @param {object} queue
   * @param {ReturnType<typeof createGamepadState>} state
   * @param {{ onConnected?: function(): void }} opts
   */
  function pollGamepad(control, getMode, modeApi, commandApi, queue, state, opts) {
    opts = opts || {};
    var pad = activePad(state);
    var mode = getMode();
    if (!pad) {
      if (control.source === "gamepad") {
        control.steer = 0;
        control.source = null;
      }
      state.prevButtons = [];
      return;
    }

    var steerRaw = readSteerAxis(pad);
    var steer = modeApi.filterSteer(steerRaw, "gamepad", mode);
    if (steerRaw !== 0 && steer !== 0) {
      control.steer = steer;
      control.source = "gamepad";
    } else if (control.source === "gamepad") {
      control.steer = 0;
      control.source = null;
    }

    var buttons = pad.buttons;
    var i;
    for (i = 0; i < buttons.length; i++) {
      var pressed = !!buttons[i].pressed;
      var was = !!state.prevButtons[i];
      if (pressed && !was) {
        if (i === REMAP.fire) {
          commandApi.enqueue(queue, {
            type: "fire",
            payload: { side: "center" },
            source: "gamepad",
          });
        } else if (i === REMAP.specialPrimary || i === REMAP.specialAlt) {
          commandApi.enqueue(queue, {
            type: "special",
            payload: {},
            source: "gamepad",
          });
        }
      }
      state.prevButtons[i] = pressed;
    }
    while (state.prevButtons.length < buttons.length) {
      state.prevButtons.push(false);
    }
  }

  /**
   * @param {ReturnType<typeof createGamepadState>} state
   * @param {{ onConnected?: function(): void, onDisconnected?: function(): void }} opts
   * @param {{ steer: number, source: string | null }} control
   */
  function attachGamepadListeners(state, control, opts) {
    opts = opts || {};

    /**
     * @param {GamepadEvent} ev
     */
    function onConnect(ev) {
      state.slotIndex = ev.gamepad.index;
      state.disconnectSteerActive = false;
      if (opts.onConnected) {
        opts.onConnected();
      }
    }

    /**
     * @param {GamepadEvent} ev
     */
    function onDisconnect(ev) {
      if (state.slotIndex === ev.gamepad.index) {
        state.slotIndex = null;
      }
      state.injectPad = null;
      control.steer = 0;
      control.source = null;
      state.prevButtons = [];
      if (opts.onDisconnected) {
        opts.onDisconnected();
      }
    }

    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);

    return function detach() {
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }

  /**
   * @param {ReturnType<typeof createGamepadState>} state
   * @param {{ axes?: number[], buttons?: boolean[] }} spec
   */
  function injectTestGamepad(state, spec) {
    var axes = spec.axes || [0, 0];
    var buttons = spec.buttons || [];
    var btns = [];
    var i;
    for (i = 0; i < 16; i++) {
      btns.push({ pressed: !!buttons[i], value: buttons[i] ? 1 : 0 });
    }
    state.injectPad = {
      axes: axes,
      buttons: btns,
      connected: true,
      id: "test-pad",
      index: 0,
      mapping: "standard",
      timestamp: performance.now(),
    };
    state.slotIndex = 0;
  }

  function clearInjectedGamepad(state) {
    state.injectPad = null;
    state.slotIndex = null;
  }

  /**
   * @param {{ steer: number, source: string | null }} control
   * @param {() => string} getMode
   * @param {object} modeApi
   * @param {object} commandApi
   * @param {object} queue
   * @param {{ onConnected?: function(): void }} [opts]
   */
  function attachGamepad(control, getMode, modeApi, commandApi, queue, opts) {
    var state = createGamepadState();
    var detach = attachGamepadListeners(state, control, opts);
    return {
      state: state,
      poll: function () {
        pollGamepad(control, getMode, modeApi, commandApi, queue, state, opts);
      },
      injectTestGamepad: function (spec) {
        injectTestGamepad(state, spec);
      },
      clearInjectedGamepad: function () {
        clearInjectedGamepad(state);
        control.steer = 0;
        control.source = null;
      },
      simulateDisconnect: function () {
        clearInjectedGamepad(state);
        control.steer = 0;
        control.source = null;
        state.prevButtons = [];
        if (opts && opts.onDisconnected) {
          opts.onDisconnected();
        }
      },
      detach: detach,
    };
  }

  var api = {
    REMAP: REMAP,
    attachGamepad: attachGamepad,
    pollGamepad: pollGamepad,
    createGamepadState: createGamepadState,
    injectTestGamepad: injectTestGamepad,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopInputGamepad = api;
  }
})();
