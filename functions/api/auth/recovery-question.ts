import { currentSession, hashRecoveryAnswer, isSameOriginMutation, json, readJson, recoveryAnswerIsValid, recoveryQuestionIsValid, type PagesContext } from "../../_shared/server";

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!await currentSession(request, env)) return json({ error: "Sign in to view editor settings." }, 401);
  const recovery = await env.DB.prepare("SELECT question, question_2 FROM recovery_settings WHERE id = 1").first<{ question: string; question_2: string | null }>();
  return json({ question: recovery?.question || "", question2: recovery?.question_2 || "" });
}

export async function onRequestPut({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  if (!await currentSession(request, env)) return json({ error: "Sign in again to continue." }, 401);
  const body = await readJson<{ question?: unknown; answer?: unknown; question2?: unknown; answer2?: unknown }>(request, 4096);
  if (!recoveryQuestionIsValid(body?.question)) return json({ error: "Enter a recovery question with at least 8 characters." }, 400);
  const question = body.question.trim();
  if (!recoveryQuestionIsValid(body.question2)) return json({ error: "Enter a second recovery question with at least 8 characters." }, 400);
  const question2 = body.question2.trim();
  const existing = await env.DB.prepare("SELECT question, answer_salt, answer_hash, question_2, answer_salt_2, answer_hash_2 FROM recovery_settings WHERE id = 1")
    .first<{ question: string; answer_salt: string; answer_hash: string; question_2: string | null; answer_salt_2: string | null; answer_hash_2: string | null }>();

  const keepAnswer1 = Boolean(existing && existing.question === question && body.answer === "");
  if (!keepAnswer1 && !recoveryAnswerIsValid(body.answer)) return json({ error: "Enter the first answer with at least 8 characters." }, 400);
  const answer1 = keepAnswer1 ? null : await hashRecoveryAnswer(body.answer as string, env.AUTH_PEPPER);

  const keepAnswer2 = Boolean(existing && existing.question_2 === question2 && body.answer2 === "");
  if (!keepAnswer2 && !recoveryAnswerIsValid(body.answer2)) return json({ error: "Enter the second answer with at least 8 characters." }, 400);
  const answer2 = keepAnswer2 ? null : await hashRecoveryAnswer(body.answer2 as string, env.AUTH_PEPPER);

  const answer1Salt = answer1?.salt || existing?.answer_salt;
  const answer1Hash = answer1?.hash || existing?.answer_hash;
  const answer2Salt = answer2?.salt || existing?.answer_salt_2;
  const answer2Hash = answer2?.hash || existing?.answer_hash_2;
  if (!answer1Salt || !answer1Hash || !answer2Salt || !answer2Hash) return json({ error: "Enter answers for both recovery questions." }, 400);

  await env.DB.prepare(
    "INSERT INTO recovery_settings (id, question, answer_salt, answer_hash, question_2, answer_salt_2, answer_hash_2, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET question = excluded.question, answer_salt = excluded.answer_salt, answer_hash = excluded.answer_hash, question_2 = excluded.question_2, answer_salt_2 = excluded.answer_salt_2, answer_hash_2 = excluded.answer_hash_2, updated_at = excluded.updated_at"
  ).bind(question, answer1Salt, answer1Hash, question2, answer2Salt, answer2Hash, Math.floor(Date.now() / 1000)).run();
  return json({ saved: true, question, question2 });
}
