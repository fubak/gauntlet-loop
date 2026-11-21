/**
 * Client RoomPresence packing (allowlisted fields only). No location import.
 */
(function roomPresenceModule() {
  "use strict";

  var ALLOWLIST_KEYS = [
    "publicId",
    "nickname",
    "lane",
    "shipY",
    "score",
    "fireFlash",
  ];

  var FORBIDDEN_KEYS = [
    "lat",
    "lon",
    "accuracyM",
    "recordedAt",
    "sessionId",
    "token",
  ];

  /**
   * @param {object | null} raw
   * @param {string} publicId
   * @returns {object}
   */
  function packPresence(raw, publicId) {
    raw = raw || {};
    return {
      publicId: publicId,
      nickname: typeof raw.nickname === "string" ? raw.nickname : "",
      lane: typeof raw.lane === "number" ? raw.lane : 50,
      shipY: typeof raw.shipY === "number" ? raw.shipY : 82,
      score: typeof raw.score === "number" ? raw.score : 0,
      fireFlash: !!raw.fireFlash,
    };
  }

  /**
   * Mirror server allowlist check for tests.
   * @param {object} frame
   * @returns {object}
   */
  function sanitizeForWire(frame) {
    var out = packPresence(frame, frame.publicId || "Pilot-0000");
    var i;
    for (i = 0; i < FORBIDDEN_KEYS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(frame, FORBIDDEN_KEYS[i])) {
        delete out[FORBIDDEN_KEYS[i]];
      }
    }
    return out;
  }

  /**
   * @param {object} sanitized
   * @returns {boolean}
   */
  function forbiddenSurvives(sanitized) {
    var i;
    for (i = 0; i < FORBIDDEN_KEYS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(sanitized, FORBIDDEN_KEYS[i])) {
        return true;
      }
    }
    return false;
  }

  var api = {
    ALLOWLIST_KEYS: ALLOWLIST_KEYS,
    FORBIDDEN_KEYS: FORBIDDEN_KEYS,
    packPresence: packPresence,
    sanitizeForWire: sanitizeForWire,
    forbiddenSurvives: forbiddenSurvives,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopRoomPresence = api;
  }
})();
