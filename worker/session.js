/**
 * Session Durable Object and session crypto helpers.
 */

import {
  handleLocationDelete,
  handleLocationGet,
  handleLocationPut,
  handleWriterMint,
  parseLocationWrite,
  resolveLocationAuth,
  setLocationOptIn,
} from "./location.js";

/** @param {ArrayBuffer} buf */
function bufToHex(buf) {
  var bytes = new Uint8Array(buf);
  var out = "";
  var i;
  for (i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * @param {string} token
 * @returns {Promise<string>}
 */
export async function hashToken(token) {
  var data = new TextEncoder().encode(token);
  var digest = await crypto.subtle.digest("SHA-256", data);
  return bufToHex(digest);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  var i;
  var diff = 0;
  for (i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

var PUBLIC_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * @returns {string}
 */
export function mintPublicId() {
  var out = "Pilot-";
  var i;
  for (i = 0; i < 4; i++) {
    var n = crypto.getRandomValues(new Uint8Array(1))[0] % PUBLIC_ALPHABET.length;
    out += PUBLIC_ALPHABET[n];
  }
  return out;
}

/**
 * @returns {string}
 */
export function mintToken() {
  var bytes = crypto.getRandomValues(new Uint8Array(32));
  var bin = "";
  var i;
  for (i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  var b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

var SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export class SessionObject {
  /**
   * @param {DurableObjectState} state
   * @param {object} env
   */
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /**
   * @param {Request} request
   * @returns {string | null}
   */
  readBearer(request) {
    var header = request.headers.get("Authorization") || "";
    var parts = header.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
      return null;
    }
    return parts[1];
  }

  /**
   * @param {Request} request
   */
  async fetch(request) {
    var url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      var body = await request.json();
      await this.state.storage.put("meta", body);
      if (body.expiresAt) {
        await this.state.storage.setAlarm(body.expiresAt);
      }
      return new Response("ok");
    }
    if (url.pathname === "/meta" && request.method === "GET") {
      var metaGet = await this.state.storage.get("meta");
      if (!metaGet) {
        return new Response("", { status: 404 });
      }
      return Response.json({
        sessionId: metaGet.sessionId,
        publicId: metaGet.publicId,
        expiresAt: metaGet.expiresAt,
        locationOptIn: !!metaGet.locationOptIn,
      });
    }
    if (url.pathname === "/auth" && request.method === "POST") {
      var authBody = await request.json();
      var stored = await this.state.storage.get("meta");
      if (!stored || !authBody.tokenHash) {
        return new Response("", { status: 401 });
      }
      if (Date.now() > stored.expiresAt) {
        return new Response("", { status: 401 });
      }
      if (!constantTimeEqual(authBody.tokenHash, stored.tokenHash)) {
        return new Response("", { status: 401 });
      }
      stored.lastActivity = Date.now();
      await this.state.storage.put("meta", stored);
      return Response.json({
        sessionId: stored.sessionId,
        publicId: stored.publicId,
        expiresAt: stored.expiresAt,
        locationOptIn: !!stored.locationOptIn,
      });
    }
    if (url.pathname === "/opt-in" && request.method === "PUT") {
      var optBody = await request.json();
      var optMeta = await this.state.storage.get("meta");
      if (!optMeta || !optBody.tokenHash) {
        return new Response("", { status: 401 });
      }
      if (!constantTimeEqual(optBody.tokenHash, optMeta.tokenHash)) {
        return new Response("", { status: 401 });
      }
      var prevWrite = optMeta.writeTokenHash;
      setLocationOptIn(optMeta, !!optBody.locationOptIn);
      await this.state.storage.put("meta", optMeta);
      if (this.env.WRITER_INDEX && prevWrite && !optMeta.writeTokenHash) {
        await this.env.WRITER_INDEX.delete(prevWrite);
      }
      return Response.json({ locationOptIn: !!optMeta.locationOptIn });
    }
    if (url.pathname.startsWith("/location")) {
      var bearer = this.readBearer(request);
      var locMeta = await this.state.storage.get("meta");
      if (!locMeta) {
        return new Response("", { status: 401 });
      }
      var authKind = await resolveLocationAuth(bearer, locMeta);
      if (!authKind) {
        return new Response("", { status: 401 });
      }
      if (url.pathname === "/location" && request.method === "GET") {
        return handleLocationGet(locMeta, authKind);
      }
      if (url.pathname === "/location" && request.method === "PUT") {
        var putBody = await request.json();
        var parsed = parseLocationWrite(putBody);
        var putRes = handleLocationPut(locMeta, parsed);
        if (putRes.status === 200) {
          await this.state.storage.put("meta", locMeta);
          if (locMeta.expiresAt) {
            await this.state.storage.setAlarm(locMeta.expiresAt);
          }
          if (this.env.WRITER_INDEX && locMeta.writeTokenHash) {
            var putTtl = Math.max(
              60,
              Math.floor((locMeta.expiresAt - Date.now()) / 1000)
            );
            await this.env.WRITER_INDEX.put(
              locMeta.writeTokenHash,
              locMeta.tokenHash,
              { expirationTtl: putTtl }
            );
          }
        }
        return putRes;
      }
      if (url.pathname === "/location" && request.method === "DELETE") {
        var delRes = handleLocationDelete(locMeta);
        await this.state.storage.put("meta", locMeta);
        return delRes;
      }
      if (url.pathname === "/location/writer" && request.method === "POST") {
        if (authKind !== "session") {
          return new Response("", { status: 401 });
        }
        var writerRes = await handleWriterMint(locMeta);
        if (writerRes.status === 200) {
          await this.state.storage.put("meta", locMeta);
          if (this.env.WRITER_INDEX && locMeta.writeTokenHash) {
            var ttlSec = Math.max(
              60,
              Math.floor((locMeta.expiresAt - Date.now()) / 1000)
            );
            await this.env.WRITER_INDEX.put(
              locMeta.writeTokenHash,
              locMeta.tokenHash,
              { expirationTtl: ttlSec }
            );
          }
        }
        return writerRes;
      }
    }
    return new Response("", { status: 404 });
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}

/**
 * @returns {{ sessionId: string, publicId: string, token: string, expiresAt: number, tokenHash: string }}
 */
export async function createSessionRecord() {
  var sessionId = crypto.randomUUID();
  var publicId = mintPublicId();
  var token = mintToken();
  var tokenHash = await hashToken(token);
  var expiresAt = Date.now() + SESSION_TTL_MS;
  return { sessionId, publicId, token, expiresAt, tokenHash };
}
