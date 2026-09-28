import { currentSession, json, type PagesContext } from "../../_shared/server";

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  return json({ authenticated: Boolean(await currentSession(request, env)) });
}
