import { isSameOriginMutation, json, rateLimit, readJson, RecoveryRow, recoveryAnswersMatch, revokeAllSessions, storeAdminPassword, validPassword, type PagesContext } from "../../../_shared/server";

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  const [ipAllowed, globalAllowed] = await Promise.all([
    rateLimit(env, request, "reset-question-ip", 5, 900),
    rateLimit(env, request, "reset-question-global", 20, 900, "global")
  ]);
  if (!ipAllowed || !globalAllowed) return json({ error: "Too many recovery attempts. Try again in 15 minutes." }, 429);

  const body = await readJson<{ answer?: unknown; answer2?: unknown; newPassword?: unknown }>(request, 4096);
  if (typeof body?.answer !== "string" || !validPassword(body.newPassword)) {
    return json({ error: "Enter your answer and a password with at least 12 characters." }, 400);
  }

  const recovery = await env.DB.prepare("SELECT question, answer_salt, answer_hash, question_2, answer_salt_2, answer_hash_2 FROM recovery_settings WHERE id = 1").first<RecoveryRow>();
  if (!recovery || !await recoveryAnswersMatch(body.answer, typeof body.answer2 === "string" ? body.answer2 : undefined, recovery, env.AUTH_PEPPER)) {
    return json({ error: "The recovery answers were not accepted." }, 400);
  }

  await storeAdminPassword(env, body.newPassword);
  await revokeAllSessions(env);
  return json({ changed: true });
}
