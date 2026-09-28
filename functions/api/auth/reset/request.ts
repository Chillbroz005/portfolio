import { isSameOriginMutation, json, randomToken, rateLimit, sha256Hex, type PagesContext } from "../../../_shared/server";

const GENERIC_RESPONSE = { message: "If password recovery is configured, a reset link will be sent to the admin email." };

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  if (!isSameOriginMutation(request)) return json({ error: "Request rejected." }, 403);
  if (!await rateLimit(env, request, "reset-request", 3, 3600)) return json(GENERIC_RESPONSE, 202);

  const recovery = await env.DB.prepare("SELECT question FROM recovery_settings WHERE id = 1").first<{ question: string }>();
  if (!recovery || !env.ADMIN_EMAIL || !env.RESEND_API_KEY || !env.RESEND_FROM || !env.SITE_ORIGIN) return json(GENERIC_RESPONSE, 202);

  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE used_at IS NULL").run();
  await env.DB.prepare("INSERT INTO password_reset_tokens (token_hash, created_at, expires_at, used_at) VALUES (?, ?, ?, NULL)")
    .bind(await sha256Hex(token), now, now + 900).run();

  try {
    const origin = new URL(env.SITE_ORIGIN);
    if (origin.protocol !== "https:") throw new Error("SITE_ORIGIN must use HTTPS.");
    const resetUrl = `${origin.origin}/#reset=${encodeURIComponent(token)}`;
    const mailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [env.ADMIN_EMAIL],
        subject: "Portfolio admin password reset",
        text: `Use this link within 15 minutes to reset your portfolio admin password: ${resetUrl}`,
        html: `<p>Use this link within 15 minutes to reset your portfolio admin password:</p><p><a href="${resetUrl}">Reset admin password</a></p>`
      })
    });
    if (!mailResponse.ok) {
      await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").bind(await sha256Hex(token)).run();
      console.error("Password reset email delivery failed with status", mailResponse.status);
    }
  } catch {
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    console.error("Password reset email delivery is not configured.");
  }
  return json(GENERIC_RESPONSE, 202);
}
