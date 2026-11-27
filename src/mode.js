/**
 * SessionMode state machine and input filter. No combat math.
 */
(function modeModule(factory) {
  "use strict";

  /** @typedef {"boot" | "parked" | "motion"} SessionMode */
  /** @typedef {"keyboard" | "mouse" | "gamepad" | "touch" | "voice" | "typed"} CommandSource */
  /** @typedef {{ type: string, payload?: object, source: CommandSource }} CommandLike */

  /** @type {SessionMode} */
  var MODE_BOOT = "boot";
  /** @type {SessionMode} */
  var MODE_PARKED = "parked";
  /** @type {SessionMode} */
  var MODE_MOTION = "motion";

  /** @type {CommandSource[]} */
  var MOTION_COMMAND_SOURCES = ["voice", "typed"];

  /** @type {CommandSource[]} */
  var PARKED_STEER_SOURCES = ["keyboard", "mouse", "gamepad", "touch"];

  /**
   * @returns {{ mode: SessionMode }}
   */
  function createModeState() {
    return { mode: MODE_BOOT };
  }

  /**
   * @param {{ mode: SessionMode }} state
   * @param {SessionMode} next
   */
  function setSessionMode(state, next) {
    if (next !== MODE_BOOT && next !== MODE_PARKED && next !== MODE_MOTION) {
      return;
    }
    state.mode = next;
  }

  /**
   * @param {SessionMode} mode
   * @param {CommandSource} source
   * @returns {boolean}
   */
  function isCommandSourceAllowed(mode, source) {
    if (mode === MODE_PARKED) {
      return true;
    }
    if (mode === MODE_MOTION) {
      return MOTION_COMMAND_SOURCES.indexOf(source) !== -1;
    }
    return false;
  }

  /**
   * @param {SessionMode} mode
   * @param {CommandSource | null} source
   * @returns {boolean}
   */
  function isSteerSourceAllowed(mode, source) {
    if (mode !== MODE_PARKED) {
      return false;
    }
    if (source === null) {
      return false;
    }
    return PARKED_STEER_SOURCES.indexOf(source) !== -1;
  }

  /**
   * @param {CommandLike | null} command
   * @param {SessionMode} mode
   * @returns {CommandLike | null}
   */
  function filterCommand(command, mode) {
    if (!command) {
      return null;
    }
    if (!isCommandSourceAllowed(mode, command.source)) {
      return null;
    }
    return command;
  }

  /**
   * @param {number} steer
   * @param {CommandSource | null} source
   * @param {SessionMode} mode
   * @returns {number}
   */
  function filterSteer(steer, source, mode) {
    if (!isSteerSourceAllowed(mode, source)) {
      return 0;
    }
    if (steer < -1) {
      return -1;
    }
    if (steer > 1) {
      return 1;
    }
    return steer;
  }

  /**
   * @param {SessionMode} mode
   * @returns {{ steer: number, source: CommandSource | null }}
   */
  function defaultControlState(mode) {
    return {
      steer: mode === MODE_MOTION ? 0 : 0,
      source: null,
    };
  }

  var api = {
    MODE_BOOT: MODE_BOOT,
    MODE_PARKED: MODE_PARKED,
    MODE_MOTION: MODE_MOTION,
    createModeState: createModeState,
    setSessionMode: setSessionMode,
    isCommandSourceAllowed: isCommandSourceAllowed,
    isSteerSourceAllowed: isSteerSourceAllowed,
    filterCommand: filterCommand,
    filterSteer: filterSteer,
    defaultControlState: defaultControlState,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopMode = api;
  }
})(undefined);
