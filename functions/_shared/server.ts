export interface D1Result<T = unknown> {
  success: boolean;
  meta?: { changes?: number };
  results?: T[];
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1Statement;
}

export interface Env {
  DB: D1Database;
  AUTH_PEPPER: string;
  GITHUB_CONTENTS_TOKEN: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  ADMIN_EMAIL: string;
  SITE_ORIGIN: string;
  INITIAL_ADMIN_PASSWORD?: string;
}

export interface PagesContext {
  request: Request;
  env: Env;
}

export type CredentialRow = { password_salt: string; password_hash: string };
export type RecoveryRow = { question: string; answer_salt: string; answer_hash: string };

const SESSION_SECONDS = 8 * 60 * 60;

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function readJson<T>(request: Request, maxBytes = 8_000_000): Promise<T | null> {
  const declaredSize = Number(request.headers.get("Content-Length") || 0);
  if (declaredSize > maxBytes) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function randomToken(byteLength = 32): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

export async function derivePasswordHash(password: string, pepper: string, salt?: string): Promise<{ salt: string; hash: string }> {
  if (!pepper || pepper.length < 40) throw new Error("AUTH_PEPPER is not configured.");
  const saltBytes = salt ? base64UrlToBytes(salt) : crypto.getRandomValues(new Uint8Array(16));
  const encodedSalt = bytesToBase64Url(saltBytes);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${encodedSalt}:${password}`));
  return { salt: encodedSalt, hash: bytesToBase64Url(new Uint8Array(signature)) };
}

export async function verifyPassword(password: string, credential: CredentialRow, pepper: string): Promise<boolean> {
  const calculated = await derivePasswordHash(password, pepper, credential.password_salt);
  return constantTimeEqual(calculated.hash, credential.password_hash);
}

export async function verifyAdminPassword(env: Env, password: string): Promise<boolean> {
  let credential = await env.DB.prepare("SELECT password_salt, password_hash FROM admin_credentials WHERE id = 1").first<CredentialRow>();
  if (!credential) {
    const bootstrapPassword = env.INITIAL_ADMIN_PASSWORD;
    if (!bootstrapPassword || !constantTimeEqual(password, bootstrapPassword)) return false;
    const derived = await derivePasswordHash(password, env.AUTH_PEPPER);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO admin_credentials (id, password_salt, password_hash, updated_at) VALUES (1, ?, ?, ?)"
    ).bind(derived.salt, derived.hash, Math.floor(Date.now() / 1000)).run();
    credential = await env.DB.prepare("SELECT password_salt, password_hash FROM admin_credentials WHERE id = 1").first<CredentialRow>();
  }
  return credential ? verifyPassword(password, credential, env.AUTH_PEPPER) : false;
}

export async function storeAdminPassword(env: Env, password: string): Promise<void> {
  const derived = await derivePasswordHash(password, env.AUTH_PEPPER);
  await env.DB.prepare(
    "INSERT INTO admin_credentials (id, password_salt, password_hash, updated_at) VALUES (1, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET password_salt = excluded.password_salt, password_hash = excluded.password_hash, updated_at = excluded.updated_at"
  ).bind(derived.salt, derived.hash, Math.floor(Date.now() / 1000)).run();
}

function cookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const entry of cookieHeader.split(";")) {
    const [key, ...value] = entry.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export function sessionCookie(token: string, maxAge = SESSION_SECONDS): string {
  return `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function createSession(env: Env): Promise<{ token: string; cookie: string }> {
  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(token), now, now + SESSION_SECONDS).run();
  return { token, cookie: sessionCookie(token) };
}

export async function currentSession(request: Request, env: Env): Promise<string | null> {
  const token = cookieValue(request, "admin_session");
  if (!token) return null;
  const session = await env.DB.prepare("SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(await sha256Hex(token), Math.floor(Date.now() / 1000)).first<{ token_hash: string }>();
  return session ? token : null;
}

export async function revokeSession(request: Request, env: Env): Promise<void> {
  const token = cookieValue(request, "admin_session");
  if (token) await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}

export async function revokeAllSessions(env: Env): Promise<void> {
  await env.DB.prepare("DELETE FROM admin_sessions").run();
}

export async function rateLimit(env: Env, request: Request, action: string, maxHits: number, windowSeconds: number): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${action}:${await sha256Hex(ip)}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const record = await env.DB.prepare(
    "INSERT INTO auth_rate_limits (rate_key, window_start, hits) VALUES (?, ?, 1) " +
    "ON CONFLICT(rate_key) DO UPDATE SET " +
    "hits = CASE WHEN auth_rate_limits.window_start = excluded.window_start THEN auth_rate_limits.hits + 1 ELSE 1 END, " +
    "window_start = excluded.window_start RETURNING hits"
  ).bind(key, windowStart).first<{ hits: number }>();
  return (record?.hits || 0) <= maxHits;
}

export async function answerMatches(answer: string, recovery: RecoveryRow, pepper: string): Promise<boolean> {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return false;
  const calculated = await derivePasswordHash(normalized, pepper, recovery.answer_salt);
  return constantTimeEqual(calculated.hash, recovery.answer_hash);
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 12 && value.length <= 128;
}

export function recoveryQuestionIsValid(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 200;
}

export function recoveryAnswerIsValid(value: unknown): value is string {
  return typeof value === "string" && normalizeAnswer(value).length >= 8 && value.length <= 200;
}

export async function hashRecoveryAnswer(answer: string, pepper: string): Promise<{ salt: string; hash: string }> {
  return derivePasswordHash(normalizeAnswer(answer), pepper);
}

export async function cleanupExpiredRecords(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(now).run();
  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL").bind(now - 86_400).run();
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE window_start < ?").bind(now - 86_400).run();
}
