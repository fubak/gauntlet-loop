/**
 * Join public room `loop`, send allowlisted presence. No location import.
 */
(function roomClientModule() {
  "use strict";

  var POLL_MS = 200;
  var SEND_MIN_MS = 100;
  var HIDDEN_IDLE_MS = 12000;
  var ROOM_ERROR_ID = "room-error";

  /**
   * @param {object} deps
   */
  function createRoomClient(deps) {
    deps = deps || {};
    var sessionClient = deps.sessionClient || globalThis.GauntletLoopSession;
    var packPresence =
      (deps.packPresence && deps.packPresence.packPresence) ||
      (globalThis.GauntletLoopRoomPresence &&
        globalThis.GauntletLoopRoomPresence.packPresence);

    var running = false;
    var pollTimer = null;
    var lastSend = 0;
    var ws = null;
    var wsReady = false;
    var usePoll = true;
    var hiddenSince = 0;
    /** @type {object[]} */
    var remoteShips = [];
    var listeners = [];
    var localPublicId = "";
    var lastPresence = null;
    var handled401 = false;

    function notify() {
      var i;
      for (i = 0; i < listeners.length; i++) {
        listeners[i](remoteShips);
      }
    }

    /**
     * @param {object[]} ships
     */
    function applyShips(ships) {
      if (!Array.isArray(ships)) {
        return;
      }
      var filtered = [];
      var i;
      for (i = 0; i < ships.length; i++) {
        var s = ships[i];
        if (!s || typeof s.publicId !== "string") {
          continue;
        }
        if (s.publicId === localPublicId) {
          continue;
        }
        filtered.push({
          publicId: s.publicId,
          nickname: s.nickname || "",
          lane: typeof s.lane === "number" ? s.lane : 50,
          shipY: typeof s.shipY === "number" ? s.shipY : 82,
          score: typeof s.score === "number" ? s.score : 0,
          fireFlash: !!s.fireFlash,
        });
      }
      remoteShips = filtered;
      notify();
    }

    /**
     * @param {string | null} msg
     */
    function setRoomError(msg) {
      var el = document.getElementById(ROOM_ERROR_ID);
      if (!el) {
        el = document.createElement("div");
        el.id = ROOM_ERROR_ID;
        el.setAttribute("role", "status");
        document.body.appendChild(el);
      }
      if (!msg) {
        el.style.display = "none";
        el.textContent = "";
        return;
      }
      el.textContent = msg;
      el.style.display = "block";
    }

    function wsUrl() {
      if (typeof location === "undefined") {
        return "ws://127.0.0.1:8787/v1/room/loop/ws";
      }
      var proto = location.protocol === "https:" ? "wss:" : "ws:";
      return proto + "//" + location.host + "/v1/room/loop/ws";
    }

    function tryWebSocket() {
      if (typeof WebSocket === "undefined") {
        usePoll = true;
        return;
      }
      try {
        ws = new WebSocket(wsUrl());
        ws.addEventListener("open", function () {
          var stored = sessionClient && sessionClient.getSession();
          if (!stored || !stored.token) {
            return;
          }
          ws.send(JSON.stringify({ type: "auth", token: stored.token }));
        });
        ws.addEventListener("message", function (ev) {
          var data;
          try {
            data = JSON.parse(String(ev.data));
          } catch (e) {
            return;
          }
          if (data.type === "auth-ok") {
            wsReady = true;
            usePoll = false;
            setRoomError(null);
          }
          if (data.type === "presence" && data.ships) {
            applyShips(data.ships);
          }
        });
        ws.addEventListener("close", function () {
          wsReady = false;
          usePoll = true;
          schedulePoll();
        });
        ws.addEventListener("error", function () {
          wsReady = false;
          usePoll = true;
          schedulePoll();
        });
      } catch (e) {
        usePoll = true;
      }
    }

    function clearPoll() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function schedulePoll() {
      clearPoll();
      if (!running || !usePoll) {
        return;
      }
      pollTimer = setInterval(pollOnce, POLL_MS);
      pollOnce();
    }

    function pollOnce() {
      if (!sessionClient) {
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      sessionClient
        .fetchWithAuth("/v1/room/loop", { method: "GET" })
        .then(function (res) {
          if (res.status === 401) {
            return handle401();
          }
          if (!res.ok) {
            setRoomError("Room idle.");
            return;
          }
          setRoomError(null);
          return res.json().then(function (data) {
            applyShips(data.ships || []);
          });
        })
        .catch(function () {
          setRoomError("Room idle.");
        });
    }

    function handle401() {
      if (handled401 || !sessionClient) {
        return Promise.resolve();
      }
      handled401 = true;
      return sessionClient.initSession().then(function () {
        handled401 = false;
        tryWebSocket();
      });
    }

  /**
   * @param {object} presenceFields
   * @param {boolean} idle
   */
    function sendPresence(presenceFields, idle) {
      if (!running || !sessionClient || !packPresence) {
        return;
      }
      var now = Date.now();
      if (now - lastSend < SEND_MIN_MS) {
        return;
      }
      lastSend = now;
      var stored = sessionClient.getSession();
      if (!stored || !stored.token) {
        return;
      }
      localPublicId = stored.publicId || localPublicId;
      var body = {
        presence: packPresence(presenceFields, localPublicId),
        idle: !!idle,
      };
      lastPresence = body.presence;
      if (ws && wsReady && ws.readyState === WebSocket.OPEN) {
        body.type = "update";
        ws.send(JSON.stringify(body));
        return;
      }
      sessionClient
        .fetchWithAuth("/v1/room/loop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        .then(function (res) {
          if (res.status === 401) {
            return handle401();
          }
          if (!res.ok) {
            setRoomError("Room idle.");
            return;
          }
          setRoomError(null);
          return res.json().then(function (data) {
            applyShips(data.ships || []);
          });
        })
        .catch(function () {
          setRoomError("Room idle.");
        });
    }

    function bindVisibility() {
      if (typeof document === "undefined") {
        return;
      }
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          hiddenSince = Date.now();
          sendPresence(lastPresence || {}, true);
          clearPoll();
        } else {
          hiddenSince = 0;
          schedulePoll();
          if (lastPresence) {
            sendPresence(lastPresence, false);
          }
        }
      });
    }

    function start() {
      if (running) {
        return;
      }
      running = true;
      handled401 = false;
      bindVisibility();
      tryWebSocket();
      schedulePoll();
    }

    function stop() {
      running = false;
      clearPoll();
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          /* ignore */
        }
        ws = null;
        wsReady = false;
      }
      if (sessionClient) {
        sessionClient
          .fetchWithAuth("/v1/room/loop", { method: "DELETE" })
          .catch(function () {
            /* ignore */
          });
      }
    }

    /**
     * @param {object} presenceFields
     */
    function tick(presenceFields) {
      if (!running) {
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        if (hiddenSince && Date.now() - hiddenSince > HIDDEN_IDLE_MS) {
          sendPresence(presenceFields, true);
        }
        return;
      }
      sendPresence(presenceFields, false);
    }

    return {
      start: start,
      stop: stop,
      tick: tick,
      getRemoteShips: function () {
        return remoteShips;
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
      setRoomError: setRoomError,
    };
  }

  var api = {
    createRoomClient: createRoomClient,
    POLL_MS: POLL_MS,
    SEND_MIN_MS: SEND_MIN_MS,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.GauntletLoopRoom = api;
  }
})();
