/**
 * Gauntlet Loop Worker: health, session API, static packed game.
 */
import {
  SessionObject,
  createSessionRecord,
  hashToken,
} from "./session.js";

export { SessionObject };

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
 * @param {Request} request
 * @param {string} tokenHash
 */
function sessionStub(env, tokenHash) {
  var id = env.SESSION.idFromName(tokenHash);
  return env.SESSION.get(id);
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

    if (url.pathname.startsWith("/v1/")) {
      return new Response("", { status: 404, headers: noStoreHeaders() });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Gauntlet Loop", { status: 404 });
  },
};
