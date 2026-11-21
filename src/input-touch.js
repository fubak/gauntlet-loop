/**
 * Touch steer pad and fire/special targets. Hide on keyboard/pad, show on touch.
 */
(function inputTouchModule() {
  "use strict";

  /**
   * @param {() => string} getMode
   * @param {{ MODE_MOTION: string }} modeApi
   * @param {{ steer: number, source: string | null }} control
   * @param {{ filterSteer: function(number, string|null, string): number }} modeApiFull
   * @param {{ enqueue: function(object, object): object }} commandApi
   * @param {object} queue
   */
  function attachTouch(control, getMode, modeApi, modeApiFull, commandApi, queue) {
    var root = document.createElement("div");
    root.id = "touch-overlay";
    root.setAttribute("aria-hidden", "true");

    var steerPad = document.createElement("div");
    steerPad.className = "touch-steer";
    steerPad.setAttribute("role", "presentation");

    var actions = document.createElement("div");
    actions.className = "touch-actions";

    var fireBtn = document.createElement("button");
    fireBtn.type = "button";
    fireBtn.className = "touch-fire";
    fireBtn.textContent = "Fire";

    var specialBtn = document.createElement("button");
    specialBtn.type = "button";
    specialBtn.className = "touch-special";
    specialBtn.textContent = "Special";

    actions.appendChild(fireBtn);
    actions.appendChild(specialBtn);
    root.appendChild(steerPad);
    root.appendChild(actions);
    document.body.appendChild(root);

    var visible = true;
    var steerPointerId = null;

    function shouldShow() {
      return getMode() !== modeApi.MODE_MOTION;
    }

    function syncDisplay() {
      if (!shouldShow() || !visible) {
        root.style.display = "none";
        root.setAttribute("aria-hidden", "true");
      } else {
        root.style.display = "flex";
        root.setAttribute("aria-hidden", "false");
      }
    }

    function hide() {
      visible = false;
      steerPointerId = null;
      if (control.source === "touch") {
        control.steer = 0;
        control.source = null;
      }
      syncDisplay();
    }

    function show() {
      if (!shouldShow()) {
        return;
      }
      visible = true;
      syncDisplay();
    }

    /**
     * @param {PointerEvent} ev
     */
    function onFirstTouch(ev) {
      if (!visible && shouldShow()) {
        show();
      }
    }

    /**
     * @param {PointerEvent} ev
     */
    function onSteerDown(ev) {
      if (!visible || !shouldShow()) {
        return;
      }
      steerPointerId = ev.pointerId;
      steerPad.setPointerCapture(ev.pointerId);
      updateSteerFromEvent(ev);
      ev.preventDefault();
    }

    /**
     * @param {PointerEvent} ev
     */
    function updateSteerFromEvent(ev) {
      var rect = steerPad.getBoundingClientRect();
      var mid = rect.left + rect.width * 0.5;
      var t = (ev.clientX - mid) / (rect.width * 0.5);
      if (t < -1) {
        t = -1;
      }
      if (t > 1) {
        t = 1;
      }
      var steer = modeApiFull.filterSteer(t, "touch", getMode());
      control.steer = steer;
      if (steer !== 0) {
        control.source = "touch";
      }
    }

    /**
     * @param {PointerEvent} ev
     */
    function onSteerMove(ev) {
      if (ev.pointerId !== steerPointerId) {
        return;
      }
      updateSteerFromEvent(ev);
      ev.preventDefault();
    }

    /**
     * @param {PointerEvent} ev
     */
    function onSteerUp(ev) {
      if (ev.pointerId !== steerPointerId) {
        return;
      }
      steerPointerId = null;
      if (control.source === "touch") {
        control.steer = 0;
        control.source = null;
      }
    }

    /**
     * @param {PointerEvent} ev
     */
    function onBodyPointer(ev) {
      if (visible || !shouldShow()) {
        return;
      }
      var t = ev.target;
      if (t instanceof Element && t.closest("#typed-input-wrap")) {
        return;
      }
      show();
    }

    document.addEventListener("pointerdown", onBodyPointer);

    steerPad.addEventListener("pointerdown", onSteerDown);
    steerPad.addEventListener("pointermove", onSteerMove);
    steerPad.addEventListener("pointerup", onSteerUp);
    steerPad.addEventListener("pointercancel", onSteerUp);

    fireBtn.addEventListener("click", function () {
      commandApi.enqueue(queue, {
        type: "fire",
        payload: { side: "center" },
        source: "touch",
      });
    });
    specialBtn.addEventListener("click", function () {
      commandApi.enqueue(queue, {
        type: "special",
        payload: {},
        source: "touch",
      });
    });

    syncDisplay();

    return {
      hide: hide,
      show: show,
      isVisible: function () {
        return visible && shouldShow() && root.style.display !== "none";
      },
      rootElement: root,
      syncDisplay: syncDisplay,
      destroy: function () {
        root.remove();
      },
    };
  }

  var api = {
    attachTouch: attachTouch,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopInputTouch = api;
  }
})();
