/**
 * requestAnimationFrame tick: drain queue, steer, sim, render.
 */
(function loopModule() {
  "use strict";

  /**
   * @param {{
   *   onTick: (dt: number) => void,
   *   onFrame: () => void
   * }} opts
   * @returns {() => void}
   */
  function startGameLoop(opts) {
    var running = true;
    var last = performance.now();

    function frame(now) {
      if (!running) {
        return;
      }
      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) {
        dt = 0.05;
      }
      opts.onTick(dt);
      opts.onFrame();
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    return function stop() {
      running = false;
    };
  }

  var api = {
    startGameLoop: startGameLoop,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopLoop = api;
  }
})();
