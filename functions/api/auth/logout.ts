import { isSameOriginMutation, json, revokeSession, sessionCookie, type PagesContext } from "../../_shared/server";

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  await revokeSession(request, env);
  return json({ authenticated: false }, 200, { "Set-Cookie": sessionCookie("", 0) });
}
