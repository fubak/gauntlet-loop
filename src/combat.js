/**
 * Combat: lock, fire thirds, special, loot, collect-all. No parsing or drawing.
 */
(function combatModule() {
  "use strict";

  var WEAPON_COOLDOWN = 0.15;
  var SPECIAL_COOLDOWN = 4.0;
  var MAGNET_DURATION = 2.5;
  var ENEMY_SPEED = 28;
  var SPAWN_INTERVAL = 2.4;
  var SPECIAL_RADIUS = 22;
  var LOOT_MAGNET_SPEED = 55;

  /** @typedef {"red" | "blue" | "green"} EnemyColor */
  /** @typedef {"chevron" | "stripe" | "diamond"} MarkKind */

  /**
   * @typedef {{
   *   id: number,
   *   x: number,
   *   y: number,
   *   color: EnemyColor,
   *   mark: MarkKind,
   *   alive: boolean
   * }} Enemy

   * @typedef {{
   *   id: number,
   *   x: number,
   *   y: number,
   *   vx: number,
   *   vy: number
   * }} Loot

   * @typedef {{
   *   enemies: Enemy[],
   *   loot: Loot[],
   *   lockEnemyId: number | null,
   *   lockColor: EnemyColor | null,
   *   weaponCooldown: number,
   *   specialCooldown: number,
   *   magnetUntil: number,
   *   spawnTimer: number,
   *   nextEnemyId: number,
   *   nextLootId: number,
   *   score: number,
   *   lastHitEnemyId: number | null,
   *   specialFlashUntil: number,
   *   autoSpawn: boolean
   * }} CombatState
   */

  var COLOR_MARK = {
    red: "chevron",
    blue: "stripe",
    green: "diamond",
  };

  /**
   * @returns {CombatState}
   */
  function createCombat() {
    return {
      enemies: [],
      loot: [],
      lockEnemyId: null,
      lockColor: null,
      weaponCooldown: 0,
      specialCooldown: 0,
      magnetUntil: 0,
      spawnTimer: 0,
      nextEnemyId: 1,
      nextLootId: 1,
      score: 0,
      lastHitEnemyId: null,
      specialFlashUntil: 0,
      autoSpawn: true,
    };
  }

  /**
   * @param {Enemy} enemy
   * @param {{ playerX: number, playerY: number }} sim
   * @returns {number}
   */
  function distanceAhead(enemy, sim) {
    return sim.playerY - enemy.y;
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number, worldWidth: number }} sim
   * @returns {Enemy | null}
   */
  function getLockedEnemy(combat, sim) {
    if (combat.lockEnemyId === null) {
      return null;
    }
    var i;
    for (i = 0; i < combat.enemies.length; i++) {
      var e = combat.enemies[i];
      if (e.id === combat.lockEnemyId && e.alive) {
        return e;
      }
    }
    return null;
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number }} sim
   * @param {EnemyColor | null} color
   * @returns {Enemy | null}
   */
  function nearestEnemy(combat, sim, color) {
    var best = null;
    var bestDist = Infinity;
    var i;
    for (i = 0; i < combat.enemies.length; i++) {
      var e = combat.enemies[i];
      if (!e.alive) {
        continue;
      }
      if (color && e.color !== color) {
        continue;
      }
      var d = distanceAhead(e, sim);
      if (d >= 0 && d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * @param {number} x
   * @param {number} worldWidth
   * @returns {"left" | "center" | "right"}
   */
  function laneThird(x, worldWidth) {
    var t = x / worldWidth;
    if (t < 0.34) {
      return "left";
    }
    if (t > 0.66) {
      return "right";
    }
    return "center";
  }

  /**
   * @param {Enemy} enemy
   * @param {"left" | "right" | "center"} side
   * @param {number} worldWidth
   * @returns {boolean}
   */
  function enemyInThird(enemy, side, worldWidth) {
    return laneThird(enemy.x, worldWidth) === side;
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number, worldWidth: number }} sim
   * @param {{ color?: EnemyColor, side?: string }} payload
   * @returns {Enemy | null}
   */
  function pickFireTarget(combat, sim, payload) {
    var side = payload.side || "center";
    if (side !== "left" && side !== "right" && side !== "center") {
      side = "center";
    }
    var color =
      payload.color !== undefined && payload.color !== null ? payload.color : null;
    var locked = getLockedEnemy(combat, sim);
    if (!color && locked && enemyInThird(locked, side, sim.worldWidth)) {
      return locked;
    }
    if (color && locked && locked.color === color && enemyInThird(locked, side, sim.worldWidth)) {
      return locked;
    }
    var best = null;
    var bestDist = Infinity;
    var i;
    for (i = 0; i < combat.enemies.length; i++) {
      var e = combat.enemies[i];
      if (!e.alive) {
        continue;
      }
      if (color && e.color !== color) {
        continue;
      }
      if (!enemyInThird(e, side, sim.worldWidth)) {
        continue;
      }
      var d = distanceAhead(e, sim);
      if (d >= 0 && d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * @param {CombatState} combat
   * @param {Enemy} enemy
   */
  function killEnemy(combat, enemy) {
    enemy.alive = false;
    combat.score += 1;
    if (combat.lockEnemyId === enemy.id) {
      combat.lockEnemyId = null;
    }
    combat.loot.push({
      id: combat.nextLootId++,
      x: enemy.x,
      y: enemy.y,
      vx: 0,
      vy: 0,
    });
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number, worldWidth: number }} sim
   * @param {{ type: string, payload?: object }} cmd
   */
  function handleCommand(combat, sim, cmd) {
    var payload = cmd.payload || {};
    if (cmd.type === "target-color" && payload.color) {
      combat.lockColor = payload.color;
      var colored = nearestEnemy(combat, sim, payload.color);
      if (colored) {
        combat.lockEnemyId = colored.id;
      }
      return;
    }
    if (cmd.type === "focus-nearest") {
      var nearest = nearestEnemy(combat, sim, null);
      if (nearest) {
        combat.lockEnemyId = nearest.id;
        combat.lockColor = nearest.color;
      }
      return;
    }
    if (cmd.type === "collect-all") {
      combat.magnetUntil = performance.now() / 1000 + MAGNET_DURATION;
      return;
    }
    if (cmd.type === "fire") {
      tryFire(combat, sim, payload);
      return;
    }
    if (cmd.type === "special") {
      trySpecial(combat, sim);
    }
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number, worldWidth: number }} sim
   * @param {object} payload
   */
  function tryFire(combat, sim, payload) {
    if (combat.weaponCooldown > 0) {
      return;
    }
    var target = pickFireTarget(combat, sim, payload);
    if (!target) {
      return;
    }
    combat.weaponCooldown = WEAPON_COOLDOWN;
    combat.lockEnemyId = target.id;
    combat.lastHitEnemyId = target.id;
    killEnemy(combat, target);
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number }} sim
   */
  function trySpecial(combat, sim) {
    if (combat.specialCooldown > 0) {
      return;
    }
    combat.specialCooldown = SPECIAL_COOLDOWN;
    combat.specialFlashUntil = performance.now() / 1000 + 0.25;
    var i;
    for (i = 0; i < combat.enemies.length; i++) {
      var e = combat.enemies[i];
      if (!e.alive) {
        continue;
      }
      var dx = e.x - sim.playerX;
      var dy = e.y - sim.playerY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= SPECIAL_RADIUS) {
        combat.lastHitEnemyId = e.id;
        killEnemy(combat, e);
      }
    }
  }

  /**
   * @param {CombatState} combat
   * @param {number} dt
   */
  function tickCooldowns(combat, dt) {
    if (combat.weaponCooldown > 0) {
      combat.weaponCooldown -= dt;
      if (combat.weaponCooldown < 0) {
        combat.weaponCooldown = 0;
      }
    }
    if (combat.specialCooldown > 0) {
      combat.specialCooldown -= dt;
      if (combat.specialCooldown < 0) {
        combat.specialCooldown = 0;
      }
    }
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number, worldWidth: number }} sim
   * @param {number} dt
   */
  function step(combat, sim, dt) {
    tickCooldowns(combat, dt);
    var now = performance.now() / 1000;
    var i;
    for (i = 0; i < combat.enemies.length; i++) {
      var e = combat.enemies[i];
      if (!e.alive) {
        continue;
      }
      e.y += ENEMY_SPEED * dt;
    }
    for (i = combat.enemies.length - 1; i >= 0; i--) {
      if (!combat.enemies[i].alive) {
        combat.enemies.splice(i, 1);
      }
    }
    if (combat.autoSpawn) {
      combat.spawnTimer -= dt;
      if (combat.spawnTimer <= 0) {
        combat.spawnTimer = SPAWN_INTERVAL;
        spawnEnemy(combat, sim);
      }
    }
    var magnet = now < combat.magnetUntil;
    for (i = 0; i < combat.loot.length; i++) {
      var L = combat.loot[i];
      if (magnet) {
        var lx = sim.playerX - L.x;
        var ly = sim.playerY - L.y;
        var len = Math.sqrt(lx * lx + ly * ly) || 1;
        L.vx = (lx / len) * LOOT_MAGNET_SPEED;
        L.vy = (ly / len) * LOOT_MAGNET_SPEED;
      }
      L.x += L.vx * dt;
      L.y += L.vy * dt;
      var distLoot =
        Math.sqrt(
          (L.x - sim.playerX) * (L.x - sim.playerX) +
            (L.y - sim.playerY) * (L.y - sim.playerY)
        ) < 3;
      if (distLoot) {
        combat.loot.splice(i, 1);
        i--;
        combat.score += 1;
      }
    }
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number, worldWidth: number }} sim
   */
  function spawnEnemy(combat, sim) {
    var colors = ["red", "blue", "green"];
    var color = colors[Math.floor(Math.random() * colors.length)];
    var mark = COLOR_MARK[color];
    combat.enemies.push({
      id: combat.nextEnemyId++,
      x: 26 + Math.random() * (sim.worldWidth - 52),
      y: 8 + Math.random() * 18,
      color: color,
      mark: mark,
      alive: true,
    });
  }

  /**
   * @param {CombatState} combat
   * @param {{ playerX: number, playerY: number }} sim
   * @param {{ id?: number, x: number, y: number, color: EnemyColor }[]} specs
   */
  function placeTestEnemies(combat, sim, specs) {
    combat.autoSpawn = false;
    combat.enemies = [];
    combat.lockColor = null;
    combat.lockEnemyId = null;
    combat.weaponCooldown = 0;
    var i;
    for (i = 0; i < specs.length; i++) {
      var s = specs[i];
      var color = s.color;
      var mark = COLOR_MARK[color];
      combat.enemies.push({
        id: s.id !== undefined ? s.id : combat.nextEnemyId++,
        x: s.x,
        y: s.y,
        color: color,
        mark: mark,
        alive: true,
      });
    }
  }

  var api = {
    WEAPON_COOLDOWN: WEAPON_COOLDOWN,
    SPECIAL_COOLDOWN: SPECIAL_COOLDOWN,
    createCombat: createCombat,
    handleCommand: handleCommand,
    step: step,
    placeTestEnemies: placeTestEnemies,
    nearestEnemy: nearestEnemy,
    getLockedEnemy: getLockedEnemy,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopCombat = api;
  }
})();
