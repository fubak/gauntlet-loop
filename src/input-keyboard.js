/**
 * WASD, arrows, Space fire, E special. Ignores text fields.
 */
(function inputKeyboardModule() {
  "use strict";

  /** @typedef {{ steer: number, source: string | null }} ControlState */

  var LEFT_KEYS = { ArrowLeft: true, KeyA: true, a: true };
  var RIGHT_KEYS = { ArrowRight: true, KeyD: true, d: true };

  /**
   * @param {EventTarget | null} target
   * @returns {boolean}
   */
  function isTextEntryTarget(target) {
    if (!target || !(target instanceof Element)) {
      return false;
    }
    var tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return true;
    }
    if (target.isContentEditable) {
      return true;
    }
    return false;
  }

  /**
   * @param {ControlState} control
   * @param {() => string} getMode
   * @param {{ filterSteer: function(number, string|null, string): number }} modeApi
   * @param {{ enqueue: function(queue: object, partial: object): object }} commandApi
   * @param {object} queue
   * @param {{ onGameplayKey?: function(): void }} [opts]
   */
  function attachKeyboard(control, getMode, modeApi, commandApi, queue, opts) {
    opts = opts || {};
    var heldLeft = false;
    var heldRight = false;

    function notifyGameplay() {
      if (opts.onGameplayKey) {
        opts.onGameplayKey();
      }
    }

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
      } else if (raw === 0 && control.source === "keyboard") {
        control.source = null;
      }
    }

    /**
     * @param {KeyboardEvent} ev
     */
    function onKeyDown(ev) {
      if (isTextEntryTarget(ev.target)) {
        return;
      }
      var handled = false;
      if (LEFT_KEYS[ev.code] || LEFT_KEYS[ev.key]) {
        heldLeft = true;
        handled = true;
      }
      if (RIGHT_KEYS[ev.code] || RIGHT_KEYS[ev.key]) {
        heldRight = true;
        handled = true;
      }
      if (ev.code === "Space" || ev.key === " ") {
        commandApi.enqueue(queue, {
          type: "fire",
          payload: { side: "center" },
          source: "keyboard",
        });
        ev.preventDefault();
        notifyGameplay();
        return;
      }
      if (ev.code === "KeyE" || ev.key === "e" || ev.key === "E") {
        commandApi.enqueue(queue, {
          type: "special",
          payload: {},
          source: "keyboard",
        });
        ev.preventDefault();
        notifyGameplay();
        return;
      }
      if (handled) {
        ev.preventDefault();
        notifyGameplay();
      }
      recompute();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    function onKeyUp(ev) {
      if (isTextEntryTarget(ev.target)) {
        return;
      }
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
    isTextEntryTarget: isTextEntryTarget,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopInputKeyboard = api;
  }
})();
