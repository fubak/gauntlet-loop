/**
 * Session Durable Object and session crypto helpers.
 */

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
   */
  constructor(state) {
    this.state = state;
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
      var meta = await this.state.storage.get("meta");
      if (!meta) {
        return new Response("", { status: 404 });
      }
      return Response.json({
        sessionId: meta.sessionId,
        publicId: meta.publicId,
        expiresAt: meta.expiresAt,
        locationOptIn: !!meta.locationOptIn,
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
