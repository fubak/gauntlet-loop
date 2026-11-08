/**
 * Highway world state and step logic. No drawing or text parsing.
 */
(function simModule() {
  "use strict";

  var WORLD_WIDTH = 100;
  var PLAYER_Y = 18;
  var PLAYER_X_MIN = 10;
  var PLAYER_X_MAX = 90;
  var LATERAL_SPEED = 42;
  var SCROLL_SPEED = 55;

  /**
   * @typedef {{
   *   playerX: number,
   *   playerY: number,
   *   roadScroll: number,
   *   worldWidth: number,
   *   worldHeight: number
   * }} SimState
   */

  /**
   * @returns {SimState}
   */
  function createSim() {
    return {
      playerX: WORLD_WIDTH * 0.5,
      playerY: PLAYER_Y,
      roadScroll: 0,
      worldWidth: WORLD_WIDTH,
      worldHeight: 100,
    };
  }

  /**
   * @param {SimState} sim
   * @param {number} dt seconds
   * @param {number} steer -1..1
   */
  function step(sim, dt, steer) {
    var clamped = steer;
    if (clamped < -1) {
      clamped = -1;
    }
    if (clamped > 1) {
      clamped = 1;
    }
    sim.playerX += clamped * LATERAL_SPEED * dt;
    if (sim.playerX < PLAYER_X_MIN) {
      sim.playerX = PLAYER_X_MIN;
    }
    if (sim.playerX > PLAYER_X_MAX) {
      sim.playerX = PLAYER_X_MAX;
    }
    sim.roadScroll += SCROLL_SPEED * dt;
    if (sim.roadScroll > 1000) {
      sim.roadScroll = sim.roadScroll % 1000;
    }
  }

  var api = {
    createSim: createSim,
    step: step,
    PLAYER_Y: PLAYER_Y,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopSim = api;
  }
})();
