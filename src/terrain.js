/**
 * RegionFlavor from owner fix only: palette and short label.
 */
(function terrainModule() {
  "use strict";

  var GENERIC = {
    id: "generic",
    label: "Highway",
    shoulder: "#1e242d",
    road: "#3d4450",
    sky: "#0a0e14",
    accent: "#5eead4",
  };

  /** @type {Array<{ id: string, label: string, minLat: number, maxLat: number, minLon: number, maxLon: number, shoulder: string, road: string, sky: string, accent: string }>} */
  var REGIONS = [
    {
      id: "i85-huntsville",
      label: "I-85 toward Huntsville",
      minLat: 32.2,
      maxLat: 35.2,
      minLon: -87.2,
      maxLon: -85.8,
      shoulder: "#1a2e1f",
      road: "#4a4f3a",
      sky: "#0c1218",
      accent: "#86efac",
    },
  ];

  /**
   * @typedef {{ lat: number | null, lon: number | null, ok: boolean, optedOut: boolean }} FixLike
   */

  /**
   * @param {FixLike | null} fix
   * @returns {{ id: string, label: string, shoulder: string, road: string, sky: string, accent: string }}
   */
  function regionFlavor(fix) {
    if (!fix || !fix.ok || fix.optedOut) {
      return GENERIC;
    }
    if (typeof fix.lat !== "number" || typeof fix.lon !== "number") {
      return GENERIC;
    }
    var i;
    for (i = 0; i < REGIONS.length; i++) {
      var box = REGIONS[i];
      if (
        fix.lat >= box.minLat &&
        fix.lat <= box.maxLat &&
        fix.lon >= box.minLon &&
        fix.lon <= box.maxLon
      ) {
        return box;
      }
    }
    return GENERIC;
  }

  var api = {
    GENERIC: GENERIC,
    regionFlavor: regionFlavor,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopTerrain = api;
  }
})();
