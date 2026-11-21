/**
 * Public room Durable Object `loop`. Presence allowlist only.
 * Does not import location. No coordinate or token logging.
 */

import { verifySessionToken } from "./auth.js";

export var ALLOWLIST_KEYS = [
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

var PRUNE_MS = 8000;
var HIDDEN_PRUNE_MS = 15000;
var ROOM_NAME = "loop";

/**
 * @param {object | null} raw
 * @param {string} publicId
 * @returns {object | null}
 */
export function sanitizePresence(raw, publicId) {
  if (!raw || typeof raw !== "object") {
    raw = {};
  }
  var out = {
    publicId: publicId,
    nickname: typeof raw.nickname === "string" ? raw.nickname.slice(0, 32) : "",
    lane: typeof raw.lane === "number" ? raw.lane : 50,
    shipY: typeof raw.shipY === "number" ? raw.shipY : 82,
    score: typeof raw.score === "number" ? raw.score : 0,
    fireFlash: !!raw.fireFlash,
  };
  var i;
  for (i = 0; i < FORBIDDEN_KEYS.length; i++) {
    if (Object.prototype.hasOwnProperty.call(raw, FORBIDDEN_KEYS[i])) {
      /* dropped on purpose */
    }
  }
  return out;
}

/**
 * @param {object} ship
 * @returns {boolean}
 */
export function frameHasForbiddenKey(ship) {
  var i;
  for (i = 0; i < FORBIDDEN_KEYS.length; i++) {
    if (Object.prototype.hasOwnProperty.call(ship, FORBIDDEN_KEYS[i])) {
      return true;
    }
  }
  return false;
}

function logRoom(event, publicId) {
  var prefix = publicId ? String(publicId).slice(0, 8) : "unknown";
  console.log("room:" + ROOM_NAME + " " + event + " id=" + prefix);
}

export class RoomObject {
  /**
   * @param {DurableObjectState} state
   * @param {object} env
   */
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /**
   * @returns {Promise<Map<string, object>>}
   */
  async loadShips() {
    var raw = await this.state.storage.get("ships");
    if (!raw || typeof raw !== "object") {
      return new Map();
    }
    var map = new Map();
    var keys = Object.keys(raw);
    var i;
    for (i = 0; i < keys.length; i++) {
      map.set(keys[i], raw[keys[i]]);
    }
    return map;
  }

  /**
   * @param {Map<string, object>} map
   */
  async saveShips(map) {
    var obj = {};
    map.forEach(function (v, k) {
      obj[k] = v;
    });
    await this.state.storage.put("ships", obj);
  }

  /**
   * @param {Map<string, object>} map
   * @param {number} now
   */
  pruneShips(map, now) {
    var remove = [];
    map.forEach(function (ship, id) {
      var age = now - (ship.lastSeen || 0);
      var limit = ship.idle ? HIDDEN_PRUNE_MS : PRUNE_MS;
      if (age > limit) {
        remove.push(id);
      }
    });
    var i;
    for (i = 0; i < remove.length; i++) {
      map.delete(remove[i]);
    }
  }

  /**
   * @param {Map<string, object>} map
   * @returns {object[]}
   */
  shipsPayload(map) {
    var list = [];
    map.forEach(function (ship) {
      list.push({
        publicId: ship.publicId,
        nickname: ship.nickname,
        lane: ship.lane,
        shipY: ship.shipY,
        score: ship.score,
        fireFlash: ship.fireFlash,
      });
    });
    return list;
  }

  /**
   * @param {object[]} ships
   */
  broadcast(ships) {
    var socks = this.state.getWebSockets();
    var body = JSON.stringify({ type: "presence", ships: ships });
    var i;
    for (i = 0; i < socks.length; i++) {
      var ws = socks[i];
      var attachment = ws.deserializeAttachment() || {};
      if (!attachment.publicId) {
        continue;
      }
      try {
        ws.send(body);
      } catch (e) {
        /* ignore closed */
      }
    }
  }

  /**
   * @param {Request} request
   */
  async fetch(request) {
    var url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      var pair = new WebSocketPair();
      var client = pair[0];
      var server = pair[1];
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/snapshot" && request.method === "GET") {
      var mapGet = await this.loadShips();
      this.pruneShips(mapGet, Date.now());
      await this.saveShips(mapGet);
      return Response.json({ room: ROOM_NAME, ships: this.shipsPayload(mapGet) });
    }

    if (url.pathname === "/update" && request.method === "POST") {
      var publicId = request.headers.get("X-Public-Id") || "";
      if (!publicId) {
        return new Response("", { status: 400 });
      }
      var body = await request.json();
      var sanitized = sanitizePresence(body.presence || body, publicId);
      var now = Date.now();
      var mapUp = await this.loadShips();
      var idle = !!body.idle;
      sanitized.lastSeen = now;
      sanitized.idle = idle;
      mapUp.set(publicId, sanitized);
      this.pruneShips(mapUp, now);
      await this.saveShips(mapUp);
      var payload = this.shipsPayload(mapUp);
      this.broadcast(payload);
      logRoom("update", publicId);
      return Response.json({ ok: true, ships: payload });
    }

    if (url.pathname === "/leave" && request.method === "POST") {
      var leaveId = request.headers.get("X-Public-Id") || "";
      if (!leaveId) {
        return new Response("", { status: 400 });
      }
      var mapLeave = await this.loadShips();
      mapLeave.delete(leaveId);
      await this.saveShips(mapLeave);
      var leavePayload = this.shipsPayload(mapLeave);
      this.broadcast(leavePayload);
      logRoom("leave", leaveId);
      return Response.json({ ok: true, ships: leavePayload });
    }

    return new Response("", { status: 404 });
  }

  /**
   * @param {WebSocket} ws
   * @param {string | ArrayBuffer} message
   */
  async webSocketMessage(ws, message) {
    var text = typeof message === "string" ? message : new TextDecoder().decode(message);
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      ws.close(1003, "bad json");
      return;
    }
    if (data.type === "auth" && typeof data.token === "string") {
      var meta = await verifySessionToken(this.env, data.token);
      if (!meta || !meta.publicId) {
        ws.close(1008, "unauthorized");
        return;
      }
      ws.serializeAttachment({ publicId: meta.publicId });
      ws.send(JSON.stringify({ type: "auth-ok", publicId: meta.publicId }));
      var mapAuth = await this.loadShips();
      var fresh = sanitizePresence({}, meta.publicId);
      fresh.lastSeen = Date.now();
      fresh.idle = false;
      mapAuth.set(meta.publicId, fresh);
      await this.saveShips(mapAuth);
      ws.send(
        JSON.stringify({
          type: "presence",
          ships: this.shipsPayload(mapAuth),
        })
      );
      logRoom("join", meta.publicId);
      return;
    }
    var attachment = ws.deserializeAttachment() || {};
    var publicId = attachment.publicId;
    if (!publicId) {
      ws.close(1008, "unauthorized");
      return;
    }
    if (data.type === "presence" || data.type === "update") {
      var sanitized = sanitizePresence(data.presence || data, publicId);
      var now = Date.now();
      var map = await this.loadShips();
      sanitized.lastSeen = now;
      sanitized.idle = !!data.idle;
      map.set(publicId, sanitized);
      this.pruneShips(map, now);
      await this.saveShips(map);
      var ships = this.shipsPayload(map);
      this.broadcast(ships);
      ws.send(JSON.stringify({ type: "presence", ships: ships }));
    }
    if (data.type === "leave") {
      var mapOut = await this.loadShips();
      mapOut.delete(publicId);
      await this.saveShips(mapOut);
      this.broadcast(this.shipsPayload(mapOut));
      logRoom("ws-leave", publicId);
    }
  }

  /**
   * @param {WebSocket} ws
   */
  async webSocketClose(ws) {
    var attachment = ws.deserializeAttachment() || {};
    var publicId = attachment.publicId;
    if (!publicId) {
      return;
    }
    var map = await this.loadShips();
    map.delete(publicId);
    await this.saveShips(map);
    this.broadcast(this.shipsPayload(map));
    logRoom("disconnect", publicId);
  }
}
