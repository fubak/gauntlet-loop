/**
 * Client session: POST /v1/session, storage, Bearer auth, one-shot 401 recovery.
 */
(function sessionClientModule() {
  "use strict";

  var STORAGE_KEY = "gauntlet-loop-session-v1";
  var SESSION_ERROR_ID = "session-error";

  /**
   * @typedef {{ sessionId: string, publicId: string, token: string, expiresAt: number }} StoredSession
   */

  /**
   * @returns {StoredSession | null}
   */
  function loadStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var data = JSON.parse(raw);
      if (!data || !data.token || !data.sessionId) {
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {StoredSession} session
   */
  function saveStored(session) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      /* ignore quota */
    }
  }

  function clearStored() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * @param {string | null} message
   */
  function setSessionError(message) {
    var el = document.getElementById(SESSION_ERROR_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = SESSION_ERROR_ID;
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    if (!message) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.textContent = message;
    el.style.display = "block";
  }

  /**
   * @returns {Promise<StoredSession | null>}
   */
  function mintSession() {
    return fetch("/v1/session", {
      method: "POST",
      cache: "no-store",
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("mint failed");
        }
        return res.json();
      })
      .then(function (data) {
        var session = {
          sessionId: data.sessionId,
          publicId: data.publicId,
          token: data.token,
          expiresAt: data.expiresAt,
        };
        saveStored(session);
        setSessionError(null);
        return session;
      });
  }

  /**
   * @param {StoredSession} session
   * @returns {Promise<StoredSession | "unauthorized" | null>}
   */
  function verifySession(session) {
    return fetch("/v1/session", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + session.token,
      },
    }).then(function (res) {
      if (res.status === 401) {
        return "unauthorized";
      }
      if (!res.ok) {
        return null;
      }
      return res.json().then(function (meta) {
        session.expiresAt = meta.expiresAt;
        saveStored(session);
        return session;
      });
    });
  }

  /**
   * @returns {Headers}
   */
  function authHeaders() {
    var stored = loadStored();
    var headers = new Headers();
    if (stored && stored.token) {
      headers.set("Authorization", "Bearer " + stored.token);
    }
    return headers;
  }

  /**
   * @param {RequestInfo} input
   * @param {RequestInit} [init]
   * @returns {Promise<Response>}
   */
  function fetchWithAuth(input, init) {
    init = init || {};
    var headers = new Headers(init.headers || {});
    var stored = loadStored();
    if (stored && stored.token) {
      headers.set("Authorization", "Bearer " + stored.token);
    }
    init.headers = headers;
    init.cache = "no-store";
    return fetch(input, init).then(function (res) {
      if (res.status === 401) {
        return handle401Once().then(function () {
          return res;
        });
      }
      return res;
    });
  }

  var handled401 = false;

  /**
   * @returns {Promise<StoredSession | null>}
   */
  function handle401Once() {
    if (handled401) {
      return Promise.resolve(loadStored());
    }
    handled401 = true;
    clearStored();
    return mintSession().catch(function () {
      setSessionError("Session expired. Single-player continues.");
      return null;
    });
  }

  /**
   * @returns {Promise<{ session: StoredSession | null, error: string | null }>}
   */
  function initSession() {
    handled401 = false;
    var stored = loadStored();
    if (stored) {
      return verifySession(stored)
        .then(function (result) {
          if (result === "unauthorized") {
            clearStored();
            return mintSession();
          }
          if (!result) {
            throw new Error("verify failed");
          }
          return result;
        })
        .then(function (session) {
          return { session: session, error: null };
        })
        .catch(function () {
          setSessionError("Session unavailable. Single-player continues.");
          return { session: null, error: "unavailable" };
        });
    }
    return mintSession()
      .then(function (session) {
        return { session: session, error: null };
      })
      .catch(function () {
        setSessionError("Session unavailable. Single-player continues.");
        return { session: null, error: "unavailable" };
      });
  }

  /**
   * @returns {StoredSession | null}
   */
  function getSession() {
    return loadStored();
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    initSession: initSession,
    mintSession: mintSession,
    verifySession: verifySession,
    authHeaders: authHeaders,
    fetchWithAuth: fetchWithAuth,
    handle401Once: handle401Once,
    getSession: getSession,
    setSessionError: setSessionError,
    clearStored: clearStored,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopSession = api;
  }
})();
