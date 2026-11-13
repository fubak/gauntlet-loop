/**
 * Gauntlet Loop Worker: health, session API, location, static packed game.
 */
import {
  SessionObject,
  createSessionRecord,
  hashToken,
} from "./session.js";
import { RoomObject, sanitizePresence } from "./room.js";
import { verifySessionToken } from "./auth.js";

export { SessionObject, RoomObject };

/**
 * @returns {Headers}
 */
function noStoreHeaders() {
  return new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
}

/**
 * @param {Request} request
 * @returns {string | null}
 */
function readBearer(request) {
  var header = request.headers.get("Authorization") || "";
  var parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }
  if (!parts[1]) {
    return null;
  }
  return parts[1];
}

/**
 * @param {object} env
 * @param {string} tokenHash
 */
function sessionStub(env, tokenHash) {
  var id = env.SESSION.idFromName(tokenHash);
  return env.SESSION.get(id);
}

/**
 * @param {object} env
 */
function roomStub(env) {
  var id = env.ROOM.idFromName("loop");
  return env.ROOM.get(id);
}

/**
 * @param {object} env
 * @param {string} bearer
 * @returns {Promise<object>}
 */
async function routeStub(env, bearer) {
  var tokenHash = await hashToken(bearer);
  var routeHash = tokenHash;
  if (env.WRITER_INDEX) {
    var mapped = await env.WRITER_INDEX.get(tokenHash);
    if (mapped) {
      routeHash = mapped;
    }
  }
  return sessionStub(env, routeHash);
}

/**
 * @param {object} env
 * @param {string} bearer
 * @param {string} path
 * @param {string} method
 * @param {object} [body]
 * @returns {Promise<Response>}
 */
async function forwardSession(env, bearer, path, method, body) {
  var stub = await routeStub(env, bearer);
  var headers = {
    Authorization: "Bearer " + bearer,
    "Content-Type": "application/json",
  };
  var init = { method: method, headers: headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return stub.fetch(new Request("https://session" + path, init));
}

export default {
  /**
   * @param {Request} request
   * @param {object} env
   */
  async fetch(request, env) {
    var url = new URL(request.url);

    if (url.pathname === "/v1/health" && request.method === "GET") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: noStoreHeaders(),
      });
    }

    if (url.pathname === "/v1/session" && request.method === "POST") {
      var record = await createSessionRecord();
      var stub = sessionStub(env, record.tokenHash);
      await stub.fetch(
        new Request("https://session/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: record.sessionId,
            publicId: record.publicId,
            tokenHash: record.tokenHash,
            expiresAt: record.expiresAt,
            locationOptIn: false,
            lastActivity: Date.now(),
          }),
        })
      );
      return new Response(
        JSON.stringify({
          sessionId: record.sessionId,
          publicId: record.publicId,
          token: record.token,
          expiresAt: record.expiresAt,
        }),
        { status: 200, headers: noStoreHeaders() }
      );
    }

    if (url.pathname === "/v1/session" && request.method === "GET") {
      var token = readBearer(request);
      if (!token) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var tokenHash = await hashToken(token);
      var authStub = sessionStub(env, tokenHash);
      var authRes = await authStub.fetch(
        new Request("https://session/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenHash: tokenHash }),
        })
      );
      if (authRes.status === 401) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      if (!authRes.ok) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var meta = await authRes.json();
      return new Response(JSON.stringify(meta), {
        status: 200,
        headers: noStoreHeaders(),
      });
    }

    if (
      url.pathname === "/v1/session/location-opt-in" &&
      request.method === "PUT"
    ) {
      var optToken = readBearer(request);
      if (!optToken) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var optBody = await request.json();
      var optHash = await hashToken(optToken);
      var optStub = sessionStub(env, optHash);
      var optRes = await optStub.fetch(
        new Request("https://session/opt-in", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenHash: optHash,
            locationOptIn: !!optBody.locationOptIn,
          }),
        })
      );
      if (optRes.status === 401) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      if (!optRes.ok) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var optJson = await optRes.json();
      return new Response(JSON.stringify(optJson), {
        status: 200,
        headers: noStoreHeaders(),
      });
    }

    if (url.pathname === "/v1/location" && request.method === "GET") {
      var getToken = readBearer(request);
      if (!getToken) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var getRes = await forwardSession(env, getToken, "/location", "GET");
      if (getRes.status === 401) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var getJson = await getRes.json();
      return new Response(JSON.stringify(getJson), {
        status: getRes.status,
        headers: noStoreHeaders(),
      });
    }

    if (url.pathname === "/v1/location" && request.method === "PUT") {
      var putToken = readBearer(request);
      if (!putToken) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var putBody = await request.json();
      var putRes = await forwardSession(
        env,
        putToken,
        "/location",
        "PUT",
        putBody
      );
      if (putRes.status === 401) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      if (!putRes.ok) {
        return new Response("", {
          status: putRes.status,
          headers: noStoreHeaders(),
        });
      }
      var putJson = await putRes.json();
      return new Response(JSON.stringify(putJson), {
        status: 200,
        headers: noStoreHeaders(),
      });
    }

    if (url.pathname === "/v1/location" && request.method === "DELETE") {
      var delToken = readBearer(request);
      if (!delToken) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var delRes = await forwardSession(env, delToken, "/location", "DELETE");
      if (delRes.status === 401) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var delJson = await delRes.json();
      return new Response(JSON.stringify(delJson), {
        status: delRes.status,
        headers: noStoreHeaders(),
      });
    }

    if (
      url.pathname === "/v1/location/writer" &&
      request.method === "POST"
    ) {
      var writerToken = readBearer(request);
      if (!writerToken) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var writerHash = await hashToken(writerToken);
      var writerStub = sessionStub(env, writerHash);
      var writerRes = await writerStub.fetch(
        new Request("https://session/location/writer", {
          method: "POST",
          headers: { Authorization: "Bearer " + writerToken },
        })
      );
      if (writerRes.status === 401) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      if (!writerRes.ok) {
        return new Response("", {
          status: writerRes.status,
          headers: noStoreHeaders(),
        });
      }
      var writerJson = await writerRes.json();
      return new Response(JSON.stringify(writerJson), {
        status: 200,
        headers: noStoreHeaders(),
      });
    }

    if (url.pathname === "/v1/room/loop/ws" && request.method === "GET") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("", { status: 426, headers: noStoreHeaders() });
      }
      var wsReq = new Request("https://room/ws", request);
      return roomStub(env).fetch(wsReq);
    }

    if (url.pathname === "/v1/room/loop" && request.method === "GET") {
      var roomGetToken = readBearer(request);
      if (!roomGetToken) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var roomGetMeta = await verifySessionToken(env, roomGetToken);
      if (!roomGetMeta) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var snapRes = await roomStub(env).fetch(
        new Request("https://room/snapshot", { method: "GET" })
      );
      var snapJson = await snapRes.json();
      return new Response(JSON.stringify(snapJson), {
        status: 200,
        headers: noStoreHeaders(),
      });
    }

    if (url.pathname === "/v1/room/loop" && request.method === "POST") {
      var roomPostToken = readBearer(request);
      if (!roomPostToken) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var roomPostMeta = await verifySessionToken(env, roomPostToken);
      if (!roomPostMeta) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var roomBody = await request.json();
      var sanitized = sanitizePresence(
        roomBody.presence || roomBody,
        roomPostMeta.publicId
      );
      var updateRes = await roomStub(env).fetch(
        new Request("https://room/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Public-Id": roomPostMeta.publicId,
          },
          body: JSON.stringify({
            presence: sanitized,
            idle: !!roomBody.idle,
          }),
        })
      );
      if (!updateRes.ok) {
        return new Response("", {
          status: updateRes.status,
          headers: noStoreHeaders(),
        });
      }
      var updateJson = await updateRes.json();
      return new Response(JSON.stringify(updateJson), {
        status: 200,
        headers: noStoreHeaders(),
      });
    }

    if (url.pathname === "/v1/room/loop" && request.method === "DELETE") {
      var roomDelToken = readBearer(request);
      if (!roomDelToken) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var roomDelMeta = await verifySessionToken(env, roomDelToken);
      if (!roomDelMeta) {
        return new Response("", { status: 401, headers: noStoreHeaders() });
      }
      var leaveRes = await roomStub(env).fetch(
        new Request("https://room/leave", {
          method: "POST",
          headers: { "X-Public-Id": roomDelMeta.publicId },
        })
      );
      return new Response(await leaveRes.text(), {
        status: leaveRes.status,
        headers: noStoreHeaders(),
      });
    }

    if (url.pathname.startsWith("/v1/")) {
      return new Response("", { status: 404, headers: noStoreHeaders() });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Gauntlet Loop", { status: 404 });
  },
};
