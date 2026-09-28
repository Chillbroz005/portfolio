import { createSession, isSameOriginMutation, json, rateLimit, readJson, verifyAdminPassword, type PagesContext } from "../../_shared/server";

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  if (!await rateLimit(env, request, "login", 5, 900)) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  const body = await readJson<{ password?: unknown }>(request, 2048);
  if (typeof body?.password !== "string" || body.password.length > 128) return json({ error: "Enter your admin password." }, 400);

  const valid = await verifyAdminPassword(env, body.password);
  if (!valid) return json({ error: "The password was not accepted." }, 401);

  const session = await createSession(env);
  return json({ authenticated: true }, 200, { "Set-Cookie": session.cookie });
}
