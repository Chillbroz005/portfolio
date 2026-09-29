import { createSession, isSameOriginMutation, json, rateLimit, readJson, RecoveryRow, recoveryAnswersMatch, revokeAllSessions, sha256Hex, storeAdminPassword, validPassword, type PagesContext } from "../../../_shared/server";

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  if (!await rateLimit(env, request, "reset-complete", 5, 900)) return json({ error: "Too many attempts. Request a new reset link later." }, 429);
  const body = await readJson<{ token?: unknown; answer?: unknown; answer2?: unknown; newPassword?: unknown }>(request, 4096);
  if (typeof body?.token !== "string" || typeof body.answer !== "string" || !validPassword(body.newPassword)) {
    return json({ error: "Enter the reset details and a password with at least 12 characters." }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenHash = await sha256Hex(body.token);
  const reset = await env.DB.prepare("SELECT token_hash FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .bind(tokenHash, now).first<{ token_hash: string }>();
  const recovery = await env.DB.prepare("SELECT question, answer_salt, answer_hash, question_2, answer_salt_2, answer_hash_2 FROM recovery_settings WHERE id = 1").first<RecoveryRow>();
  if (!reset || !recovery || !await recoveryAnswersMatch(body.answer, typeof body.answer2 === "string" ? body.answer2 : undefined, recovery, env.AUTH_PEPPER)) return json({ error: "The reset link or answers were not accepted." }, 400);

  const claimed = await env.DB.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING token_hash")
    .bind(now, tokenHash, now).first<{ token_hash: string }>();
  if (!claimed) return json({ error: "This reset link has already been used or expired." }, 400);

  await storeAdminPassword(env, body.newPassword);
  await revokeAllSessions(env);
  const session = await createSession(env);
  return json({ changed: true }, 200, { "Set-Cookie": session.cookie });
}
