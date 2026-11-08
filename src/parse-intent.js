/**
 * Pure parseIntent(text) from the plan phrase table. No DOM, no speech.
 */
(function parseIntentModule(factory) {
  "use strict";

  /** @typedef {"red" | "blue" | "green"} EnemyColor */
  /** @typedef {{ color?: EnemyColor, side?: "left" | "right" | "center" }} CommandPayload */
  /** @typedef {{ type: string, payload?: CommandPayload, source: string }} Command */

  /** @type {EnemyColor[]} */
  var COLORS = ["red", "blue", "green"];

  /** @type {Record<string, boolean>} */
  var STOPWORDS = {
    a: true,
    an: true,
    and: true,
    at: true,
    go: true,
    ahead: true,
    my: true,
    now: true,
    one: true,
    please: true,
    the: true,
    to: true,
  };

  /**
   * @param {string} type
   * @param {CommandPayload} [payload]
   * @returns {Command}
   */
  function makeCommand(type, payload) {
    return {
      type: type,
      payload: payload ? Object.assign({}, payload) : {},
      source: "typed",
    };
  }

  /**
   * @param {string} raw
   * @returns {string}
   */
  function normalize(raw) {
    return String(raw).toLowerCase().replace(/\s+/g, " ").trim();
  }

  /**
   * @param {string} text
   * @returns {EnemyColor | null}
   */
  function findColor(text) {
    for (var i = 0; i < COLORS.length; i++) {
      var color = COLORS[i];
      var re = new RegExp("\\b" + color + "\\b");
      if (re.test(text)) {
        return color;
      }
    }
    return null;
  }

  /**
   * @param {string} text
   * @returns {"left" | "right" | null}
   */
  function findSide(text) {
    if (/\bleft\b/.test(text)) {
      return "left";
    }
    if (/\bright\b/.test(text)) {
      return "right";
    }
    return null;
  }

  /**
   * @param {string} text
   * @returns {boolean}
   */
  function hasFireVerb(text) {
    return /\b(fire|shoot)\b/.test(text);
  }

  /**
   * @param {string} norm
   * @returns {boolean}
   */
  function isBareFirePhrase(norm) {
    if (norm === "fire" || norm === "shoot") {
      return true;
    }
    var tokens = norm.split(/\s+/);
    var i;
    for (i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tok === "fire" || tok === "shoot") {
        continue;
      }
      if (STOPWORDS[tok]) {
        continue;
      }
      return false;
    }
    return hasFireVerb(norm);
  }

  /**
   * @param {string} norm
   * @returns {boolean}
   */
  function isSideOnlyPhrase(norm) {
    return (
      /\b(fire|shoot)\s+left\b/.test(norm) ||
      /\b(fire|shoot)\s+right\b/.test(norm) ||
      /\bleft\s+(fire|shoot)\b/.test(norm) ||
      /\bright\s+(fire|shoot)\b/.test(norm)
    );
  }

  /**
   * @param {string} text
   * @returns {Command[]}
   */
  function parseIntent(text) {
    var norm = normalize(text);
    if (!norm) {
      return [];
    }

    if (/\bfocus\s+nearest\b/.test(norm)) {
      return [makeCommand("focus-nearest")];
    }
    if (/\buse\s+special\b/.test(norm)) {
      return [makeCommand("special")];
    }
    if (/\bcollect\s+all\b/.test(norm)) {
      return [makeCommand("collect-all")];
    }

    if (!hasFireVerb(norm)) {
      return [];
    }

    var color = findColor(norm);
    var side = findSide(norm);

    if (color && side) {
      return [makeCommand("fire", { color: color, side: side })];
    }

    if (color) {
      return [
        makeCommand("target-color", { color: color }),
        makeCommand("fire", { color: color }),
      ];
    }

    if (isSideOnlyPhrase(norm) && side) {
      return [makeCommand("fire", { side: side })];
    }

    if (isBareFirePhrase(norm)) {
      return [makeCommand("fire", { side: "center" })];
    }

    return [];
  }

  var api = {
    parseIntent: parseIntent,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopParseIntent = api;
  }
})(undefined);
