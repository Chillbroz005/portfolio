import { isSameOriginMutation, json, readJson, sha256Hex, type PagesContext } from "../../../_shared/server";

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  const body = await readJson<{ token?: unknown }>(request, 2048);
  if (typeof body?.token !== "string" || body.token.length > 200) return json({ error: "This reset link is invalid or expired." }, 400);

  const now = Math.floor(Date.now() / 1000);
  const token = await env.DB.prepare("SELECT token_hash FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .bind(await sha256Hex(body.token), now).first<{ token_hash: string }>();
  const recovery = await env.DB.prepare("SELECT question, question_2 FROM recovery_settings WHERE id = 1").first<{ question: string; question_2: string | null }>();
  if (!token || !recovery) return json({ error: "This reset link is invalid or expired." }, 400);
  return json({ question: recovery.question, question2: recovery.question_2 || "" });
}
