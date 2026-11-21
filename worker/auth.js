/**
 * Session token verification for room and other v1 routes.
 */

import { hashToken } from "./session.js";

/**
 * @param {object} env
 * @param {string | null} bearer
 * @returns {Promise<{ publicId: string, sessionId: string, expiresAt: number } | null>}
 */
export async function verifySessionToken(env, bearer) {
  if (!bearer || !env.SESSION) {
    return null;
  }
  var tokenHash = await hashToken(bearer);
  if (env.WRITER_INDEX) {
    var mapped = await env.WRITER_INDEX.get(tokenHash);
    if (mapped) {
      return null;
    }
  }
  var id = env.SESSION.idFromName(tokenHash);
  var stub = env.SESSION.get(id);
  var authRes = await stub.fetch(
    new Request("https://session/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenHash: tokenHash }),
    })
  );
  if (authRes.status === 401 || !authRes.ok) {
    return null;
  }
  return authRes.json();
}
