/**
 * Location handlers for Session DO. No room, no coordinate logging.
 */

import { constantTimeEqual, hashToken, mintToken } from "./session.js";

export var STALE_MS = 90 * 60 * 1000;
var HARD_CAP_MS = 90 * 24 * 60 * 60 * 1000;
var SLIDE_MS = 24 * 60 * 60 * 1000;

/**
 * @param {object} meta
 */
export function slideSessionExpiry(meta) {
  var now = Date.now();
  var next = now + SLIDE_MS;
  var cap = now + HARD_CAP_MS;
  if (next > cap) {
    next = cap;
  }
  if (next > meta.expiresAt) {
    meta.expiresAt = next;
  }
}

/**
 * @param {object} body
 * @returns {object | null}
 */
export function parseLocationWrite(body) {
  if (!body || typeof body !== "object") {
    return null;
  }
  var lat = body.lat;
  var lon = body.lon;
  if (lat === undefined && body.latitude !== undefined) {
    lat = body.latitude;
  }
  if (lon === undefined && body.longitude !== undefined) {
    lon = body.longitude;
  }
  if (body.coords && typeof body.coords === "object") {
    if (lat === undefined && body.coords.lat !== undefined) {
      lat = body.coords.lat;
    }
    if (lon === undefined && body.coords.lon !== undefined) {
      lon = body.coords.lon;
    }
  }
  if (typeof lat !== "number" || typeof lon !== "number") {
    return null;
  }
  var recordedAt = body.recordedAt || body.timestamp || body.time || body.date || null;
  var recMs = recordedAt ? Date.parse(recordedAt) : Date.now();
  if (Number.isNaN(recMs)) {
    recMs = Date.now();
  }
  return {
    lat: lat,
    lon: lon,
    recordedAt: new Date(recMs).toISOString(),
    accuracyM: typeof body.accuracyM === "number" ? body.accuracyM : null,
  };
}

/**
 * @param {object | null} fix
 * @param {boolean} optedOut
 */
export function locationGetPayload(fix, optedOut) {
  if (optedOut) {
    return { optedOut: true, ok: false, stale: false };
  }
  if (!fix) {
    return { optedOut: false, ok: false, stale: false };
  }
  var recMs = Date.parse(fix.recordedAt);
  var stale = false;
  if (!Number.isNaN(recMs)) {
    stale = Date.now() - recMs > STALE_MS;
  }
  return {
    optedOut: false,
    ok: true,
    lat: fix.lat,
    lon: fix.lon,
    recordedAt: fix.recordedAt,
    accuracyM: fix.accuracyM,
    stale: stale,
  };
}

/**
 * @param {object} meta
 * @param {"session" | "write"} authKind
 */
export function handleLocationGet(meta, authKind) {
  if (authKind !== "session") {
    return new Response("", { status: 401 });
  }
  return Response.json(locationGetPayload(meta.locationFix || null, !meta.locationOptIn));
}

/**
 * @param {object} meta
 * @param {object | null} parsed
 */
export function handleLocationPut(meta, parsed) {
  if (!meta.locationOptIn) {
    return new Response("", { status: 403 });
  }
  if (!parsed) {
    return new Response("", { status: 400 });
  }
  meta.locationFix = parsed;
  slideSessionExpiry(meta);
  return Response.json({ ok: true });
}

/**
 * @param {object} meta
 */
export function handleLocationDelete(meta) {
  meta.locationFix = null;
  return Response.json({ ok: true });
}

/**
 * @param {object} meta
 */
export async function handleWriterMint(meta) {
  if (!meta.locationOptIn) {
    return new Response("", { status: 403 });
  }
  if (meta.writeTokenHash) {
    return new Response("", { status: 409 });
  }
  var writeToken = mintToken();
  meta.writeTokenHash = await hashToken(writeToken);
  return Response.json({ writeToken: writeToken });
}

/**
 * @param {string} bearer
 * @param {object} meta
 * @returns {Promise<"session" | "write" | null>}
 */
export async function resolveLocationAuth(bearer, meta) {
  if (!bearer || !meta) {
    return null;
  }
  var h = await hashToken(bearer);
  if (constantTimeEqual(h, meta.tokenHash)) {
    return "session";
  }
  if (meta.writeTokenHash && constantTimeEqual(h, meta.writeTokenHash)) {
    return "write";
  }
  return null;
}

/**
 * @param {object} meta
 * @param {boolean} optIn
 */
export function setLocationOptIn(meta, optIn) {
  meta.locationOptIn = !!optIn;
  if (!meta.locationOptIn) {
    meta.locationFix = null;
    meta.writeTokenHash = null;
  }
  return meta;
}
