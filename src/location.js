/**
 * Private location fetch, write, poll, and opt-out. No terrain art, no room.
 */
(function locationClientModule() {
  "use strict";

  var STALE_MS = 90 * 60 * 1000;
  var POLL_MS = 5 * 60 * 1000;
  var GEO_WRITE_MS = 5 * 60 * 1000;

  /**
   * @typedef {{
   *   lat: number | null,
   *   lon: number | null,
   *   recordedAt: string | null,
   *   fetchedAt: number,
   *   stale: boolean,
   *   ok: boolean,
   *   optedOut: boolean,
   *   error: string | null
   * }} LocationFix
   */

  /**
   * @returns {boolean}
   */
  function fixtureQueryEnabled() {
    if (typeof location === "undefined") {
      return false;
    }
    return /(?:\?|&)locationFixture=(?:1|stale)(?:&|$)/.test(location.search);
  }

  /**
   * @returns {string}
   */
  function fixtureUrl() {
    if (typeof location === "undefined") {
      return "/fixtures/location.sample.json";
    }
    if (/(?:\?|&)locationFixture=stale(?:&|$)/.test(location.search)) {
      return "/fixtures/location.stale.sample.json";
    }
    return "/fixtures/location.sample.json";
  }

  /**
   * @returns {LocationFix}
   */
  function emptyFix() {
    return {
      lat: null,
      lon: null,
      recordedAt: null,
      fetchedAt: 0,
      stale: false,
      ok: false,
      optedOut: false,
      error: null,
    };
  }

  /**
   * @param {object} wire
   * @param {number} fetchedAt
   * @returns {LocationFix}
   */
  function parseWire(wire, fetchedAt) {
    if (!wire || typeof wire !== "object") {
      return emptyFix();
    }
    var fix = emptyFix();
    fix.fetchedAt = fetchedAt;
    fix.optedOut = !!wire.optedOut;
    if (wire.optedOut) {
      fix.ok = false;
      return fix;
    }
    fix.ok = !!wire.ok;
    if (!fix.ok) {
      return fix;
    }
    if (typeof wire.lat === "number" && typeof wire.lon === "number") {
      fix.lat = wire.lat;
      fix.lon = wire.lon;
    }
    fix.recordedAt =
      typeof wire.recordedAt === "string" ? wire.recordedAt : null;
    if (typeof wire.stale === "boolean") {
      fix.stale = wire.stale;
    } else if (fix.recordedAt) {
      var rec = Date.parse(fix.recordedAt);
      if (!Number.isNaN(rec)) {
        fix.stale = fetchedAt - rec > STALE_MS;
      }
    }
    if (typeof wire.accuracyM === "number") {
      fix.accuracyM = wire.accuracyM;
    }
    return fix;
  }

  /**
   * @param {object} deps
   */
  function createLocationService(deps) {
    deps = deps || {};
    var sessionClient = deps.sessionClient || globalThis.GauntletLoopSession;
    function isFixtureMode() {
      return !!deps.useFixture || fixtureQueryEnabled();
    }

    /** @type {LocationFix} */
    var current = emptyFix();
    var optedIn = false;
    var timer = null;
    var lastGeoWrite = 0;
    var listeners = [];
    var visibilityBound = false;

    function notify() {
      var i;
      for (i = 0; i < listeners.length; i++) {
        listeners[i](current);
      }
    }

    /**
     * @param {LocationFix} next
     */
    function applyFix(next) {
      current = next;
      notify();
    }

    /**
     * @returns {Promise<LocationFix>}
     */
    function loadFixture() {
      return fetch(fixtureUrl(), { cache: "no-store" })
        .then(function (res) {
          if (!res.ok) {
            throw new Error("fixture failed");
          }
          return res.json();
        })
        .then(function (wire) {
          var parsed = parseWire(wire, Date.now());
          applyFix(parsed);
          return parsed;
        })
        .catch(function () {
          var prev = current;
          if (prev.ok) {
            prev.error = "fixture fetch failed";
            applyFix(prev);
            return prev;
          }
          var fail = emptyFix();
          fail.error = "fixture fetch failed";
          applyFix(fail);
          return fail;
        });
    }

    /**
     * @returns {Promise<LocationFix>}
     */
    function fetchLocation() {
      if (!optedIn) {
        var off = emptyFix();
        off.optedOut = true;
        applyFix(off);
        return Promise.resolve(off);
      }
      if (isFixtureMode()) {
        return loadFixture();
      }
      if (!sessionClient) {
        var noSession = emptyFix();
        noSession.error = "no session";
        applyFix(noSession);
        return Promise.resolve(noSession);
      }
      return sessionClient
        .fetchWithAuth("/v1/location", { method: "GET" })
        .then(function (res) {
          if (res.status === 401) {
            var unauthorized = emptyFix();
            unauthorized.error = "unauthorized";
            applyFix(unauthorized);
            return unauthorized;
          }
          if (!res.ok) {
            throw new Error("get failed");
          }
          return res.json();
        })
        .then(function (wire) {
          var parsed = parseWire(wire, Date.now());
          applyFix(parsed);
          return parsed;
        })
        .catch(function () {
          var prev = current;
          if (prev.ok) {
            prev.error = "poll failed";
            applyFix(prev);
            return prev;
          }
          var fail = emptyFix();
          fail.error = "poll failed";
          applyFix(fail);
          return fail;
        });
    }

    /**
     * @param {number} lat
     * @param {number} lon
     * @param {number} [accuracyM]
     * @returns {Promise<void>}
     */
    function putFix(lat, lon, accuracyM) {
      if (!optedIn || !sessionClient) {
        return Promise.resolve();
      }
      if (isFixtureMode()) {
        return Promise.resolve();
      }
      var body = {
        lat: lat,
        lon: lon,
        recordedAt: new Date().toISOString(),
      };
      if (typeof accuracyM === "number") {
        body.accuracyM = accuracyM;
      }
      return sessionClient
        .fetchWithAuth("/v1/location", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        .then(function (res) {
          if (res.ok) {
            lastGeoWrite = Date.now();
            return fetchLocation();
          }
        })
        .catch(function () {
          /* keep last good fix */
        });
    }

    /**
     * @returns {Promise<void>}
     */
    function deleteFix() {
      if (!sessionClient || isFixtureMode()) {
        var cleared = emptyFix();
        cleared.optedOut = true;
        applyFix(cleared);
        return Promise.resolve();
      }
      return sessionClient
        .fetchWithAuth("/v1/location", { method: "DELETE" })
        .then(function () {
          var cleared = emptyFix();
          cleared.optedOut = !optedIn;
          if (!optedIn) {
            cleared.optedOut = true;
          }
          applyFix(cleared);
        })
        .catch(function () {
          /* ignore */
        });
    }

    function maybeWriteGeo() {
      if (!optedIn || isFixtureMode()) {
        return;
      }
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        return;
      }
      if (Date.now() - lastGeoWrite < GEO_WRITE_MS) {
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          putFix(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy
          );
        },
        function () {
          /* permission denied */
        },
        { enableHighAccuracy: false, maximumAge: GEO_WRITE_MS, timeout: 12000 }
      );
    }

    function clearTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function schedulePoll() {
      clearTimer();
      if (!optedIn) {
        return;
      }
      timer = setInterval(function () {
        if (typeof document !== "undefined" && document.hidden) {
          return;
        }
        fetchLocation();
        maybeWriteGeo();
      }, POLL_MS);
    }

    /**
     * @param {boolean} optIn
     * @returns {Promise<void>}
     */
    function bindVisibilityOnce() {
      if (visibilityBound || typeof document === "undefined") {
        return;
      }
      visibilityBound = true;
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          clearTimer();
          return;
        }
        if (optedIn) {
          fetchLocation();
          maybeWriteGeo();
          schedulePoll();
        }
      });
    }

    function setOptIn(optIn) {
      optedIn = !!optIn;
      if (optedIn) {
        bindVisibilityOnce();
      } else {
        clearTimer();
      }
      if (!sessionClient || isFixtureMode()) {
        if (!optedIn) {
          var off = emptyFix();
          off.optedOut = true;
          applyFix(off);
        } else {
          fetchLocation();
          if (typeof document !== "undefined" && !document.hidden) {
            maybeWriteGeo();
          }
        }
        schedulePoll();
        return Promise.resolve();
      }
      return sessionClient
        .fetchWithAuth("/v1/session/location-opt-in", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationOptIn: optedIn }),
        })
        .then(function () {
          if (!optedIn) {
            return deleteFix();
          }
          return fetchLocation().then(function () {
            if (typeof document !== "undefined" && !document.hidden) {
              maybeWriteGeo();
            }
          });
        })
        .then(function () {
          schedulePoll();
        })
        .catch(function () {
          schedulePoll();
        });
    }

    function start(initialOptIn) {
      return setOptIn(initialOptIn);
    }

    return {
      getFix: function () {
        return current;
      },
      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          var idx = listeners.indexOf(fn);
          if (idx >= 0) {
            listeners.splice(idx, 1);
          }
        };
      },
      fetchLocation: fetchLocation,
      putFix: putFix,
      deleteFix: deleteFix,
      setOptIn: setOptIn,
      start: start,
      stop: clearTimer,
      maybeWriteGeo: maybeWriteGeo,
      parseWire: parseWire,
      STALE_MS: STALE_MS,
    };
  }

  var api = {
    createLocationService: createLocationService,
    parseWire: parseWire,
    emptyFix: emptyFix,
    STALE_MS: STALE_MS,
    fixtureQueryEnabled: fixtureQueryEnabled,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopLocation = api;
  }
})();
