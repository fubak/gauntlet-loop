/**
 * WASD, arrows, Space fire, E special.
 */
(function inputKeyboardModule() {
  "use strict";

  /** @typedef {{ steer: number, source: string | null }} ControlState */

  var LEFT_KEYS = { ArrowLeft: true, KeyA: true, a: true };
  var RIGHT_KEYS = { ArrowRight: true, KeyD: true, d: true };

  /**
   * @param {ControlState} control
   * @param {() => string} getMode
   * @param {{ filterSteer: function(number, string|null, string): number, filterCommand: function(object, string): object|null }} modeApi
   * @param {{ enqueue: function(queue: object, partial: object): object, createQueue?: never }} commandApi
   * @param {{ drain?: never }} queue
   * @param {object} queue
   */
  function attachKeyboard(control, getMode, modeApi, commandApi, queue) {
    var heldLeft = false;
    var heldRight = false;

    function recompute() {
      var raw = 0;
      if (heldLeft && !heldRight) {
        raw = -1;
      } else if (heldRight && !heldLeft) {
        raw = 1;
      }
      var mode = getMode();
      var steer = modeApi.filterSteer(raw, "keyboard", mode);
      control.steer = steer;
      if (raw !== 0 && steer !== 0) {
        control.source = "keyboard";
      } else if (raw === 0) {
        control.source = null;
      }
    }

    /**
     * @param {KeyboardEvent} ev
     */
    function onKeyDown(ev) {
      if (LEFT_KEYS[ev.code] || LEFT_KEYS[ev.key]) {
        heldLeft = true;
        ev.preventDefault();
      }
      if (RIGHT_KEYS[ev.code] || RIGHT_KEYS[ev.key]) {
        heldRight = true;
        ev.preventDefault();
      }
      if (ev.code === "Space" || ev.key === " ") {
        commandApi.enqueue(queue, {
          type: "fire",
          payload: { side: "center" },
          source: "keyboard",
        });
        ev.preventDefault();
      }
      if (ev.code === "KeyE" || ev.key === "e" || ev.key === "E") {
        commandApi.enqueue(queue, {
          type: "special",
          payload: {},
          source: "keyboard",
        });
        ev.preventDefault();
      }
      recompute();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    function onKeyUp(ev) {
      if (LEFT_KEYS[ev.code] || LEFT_KEYS[ev.key]) {
        heldLeft = false;
      }
      if (RIGHT_KEYS[ev.code] || RIGHT_KEYS[ev.key]) {
        heldRight = false;
      }
      recompute();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return {
      detach: function () {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      },
      pressFire: function () {
        commandApi.enqueue(queue, {
          type: "fire",
          payload: { side: "center" },
          source: "keyboard",
        });
      },
      pressSpecial: function () {
        commandApi.enqueue(queue, {
          type: "special",
          payload: {},
          source: "keyboard",
        });
      },
    };
  }

  var api = {
    attachKeyboard: attachKeyboard,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopInputKeyboard = api;
  }
})();
