import { json, type PagesContext } from "../../../_shared/server";

export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  const recovery = await env.DB.prepare("SELECT question FROM recovery_settings WHERE id = 1").first<{ question: string }>();
  if (!recovery?.question) return json({ error: "No recovery question is configured. Use email recovery instead." }, 404);
  return json({ question: recovery.question });
}
