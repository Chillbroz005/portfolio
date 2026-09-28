import { currentSession, hashRecoveryAnswer, isSameOriginMutation, json, readJson, recoveryAnswerIsValid, recoveryQuestionIsValid, type PagesContext } from "../../_shared/server";

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!await currentSession(request, env)) return json({ error: "Sign in to view editor settings." }, 401);
  const recovery = await env.DB.prepare("SELECT question FROM recovery_settings WHERE id = 1").first<{ question: string }>();
  return json({ question: recovery?.question || "" });
}

export async function onRequestPut({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  if (!await currentSession(request, env)) return json({ error: "Sign in again to continue." }, 401);
  const body = await readJson<{ question?: unknown; answer?: unknown }>(request, 4096);
  if (!recoveryQuestionIsValid(body?.question)) return json({ error: "Enter a recovery question with at least 8 characters." }, 400);
  const question = body.question.trim();
  const existing = await env.DB.prepare("SELECT question, answer_salt, answer_hash FROM recovery_settings WHERE id = 1").first<{ question: string; answer_salt: string; answer_hash: string }>();
  if (existing && existing.question === question && body.answer === "") return json({ saved: true, question });
  if (!recoveryAnswerIsValid(body.answer)) return json({ error: "Enter an answer with at least 8 characters." }, 400);
  const answer = await hashRecoveryAnswer(body.answer, env.AUTH_PEPPER);
  await env.DB.prepare(
    "INSERT INTO recovery_settings (id, question, answer_salt, answer_hash, updated_at) VALUES (1, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET question = excluded.question, answer_salt = excluded.answer_salt, answer_hash = excluded.answer_hash, updated_at = excluded.updated_at"
  ).bind(question, answer.salt, answer.hash, Math.floor(Date.now() / 1000)).run();
  return json({ saved: true, question });
}
