import { createSession, currentSession, isSameOriginMutation, json, rateLimit, readJson, revokeAllSessions, storeAdminPassword, validPassword, verifyAdminPassword, type PagesContext } from "../../_shared/server";

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  if (!await currentSession(request, env)) return json({ error: "Sign in again to continue." }, 401);
  if (!await rateLimit(env, request, "password-change", 5, 900)) return json({ error: "Too many attempts. Try again later." }, 429);

  const body = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(request, 4096);
  if (typeof body?.currentPassword !== "string" || !validPassword(body.newPassword)) {
    return json({ error: "Use a new password with at least 12 characters." }, 400);
  }
  if (!await verifyAdminPassword(env, body.currentPassword)) return json({ error: "The current password was not accepted." }, 401);

  await storeAdminPassword(env, body.newPassword);
  await revokeAllSessions(env);
  const session = await createSession(env);
  return json({ changed: true }, 200, { "Set-Cookie": session.cookie });
}
