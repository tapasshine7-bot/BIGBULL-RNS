// Account authentication for the RNS BIGBULL portal.
// Passwords are hashed with PBKDF2-SHA256 (no external dependencies).
// Sessions are random bearer tokens stored in D1 with a 30-day expiry.

export interface SessionAccount {
  id: number;
  email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const SESSION_TOKEN_BYTES = 32;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", utf8Encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function validateSignupInput(email: string, password: string): string | null {
  const trimmedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmedEmail)) return "Please enter a valid email address.";
  if (trimmedEmail.length > 320) return "Email address is too long.";
  if (!password || password.length < MIN_PASSWORD_LENGTH)
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 128) return "Password is too long.";
  return null;
}

async function readAccountByEmail(db: D1Database, email: string): Promise<SessionAccount | null> {
  const row = await db.prepare("SELECT id, email FROM accounts WHERE email = ?1").bind(email).first<SessionAccount>();
  return (row ?? null) as SessionAccount | null;
}

// ---- Signup ---------------------------------------------------------------

export async function handleSignup(db: D1Database, body: unknown): Promise<Response> {
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  const emailStr = typeof email === "string" ? email : "";
  const passwordStr = typeof password === "string" ? password : "";

  const validationError = validateSignupInput(emailStr, passwordStr);
  if (validationError) return jsonResponse(400, { error: validationError });

  const emailNorm = emailStr.trim().toLowerCase();
  const existing = await readAccountByEmail(db, emailNorm);
  if (existing) return jsonResponse(409, { error: "An account with this email already exists." });

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const passwordHash = await hashPassword(passwordStr, salt);

  await db
    .prepare("INSERT INTO accounts (email, password_hash, salt_hex, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(emailNorm, passwordHash, Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join(""), new Date().toISOString())
    .run();

  const account = await readAccountByEmail(db, emailNorm);
  if (!account) return jsonResponse(502, { error: "Account creation failed." });

  const session = await createSession(db, account.id);
  return jsonResponse(201, { user: account, token: session.token });
}

// ---- Login ----------------------------------------------------------------

async function loadAccountCredentials(db: D1Database, email: string): Promise<{
  id: number;
  email: string;
  passwordHash: string;
  saltHex: string;
} | null> {
  const row = await db.prepare("SELECT id, email, password_hash, salt_hex FROM accounts WHERE email = ?1").bind(email).first<{ id: number; email: string; password_hash: string; salt_hex: string }>();
  if (!row) return null;
  return { id: row.id, email: row.email, passwordHash: row.password_hash, saltHex: row.salt_hex };
}

export async function handleLogin(db: D1Database, body: unknown): Promise<Response> {
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  const emailStr = typeof email === "string" ? email : "";
  const passwordStr = typeof password === "string" ? password : "";

  if (!EMAIL_RE.test(emailStr.trim().toLowerCase()) || !passwordStr) {
    // Never reveal whether the account exists on invalid input.
    return jsonResponse(401, { error: "Invalid email or password." });
  }

  const emailNorm = emailStr.trim().toLowerCase();
  const account = await loadAccountCredentials(db, emailNorm);
  if (!account) return jsonResponse(401, { error: "Invalid email or password." });

  const salt = new Uint8Array(
    account.saltHex.match(/.{2}/g)!.map((hex) => Number.parseInt(hex, 16)),
  );
  const hash = await hashPassword(passwordStr, salt);

  // Constant-time comparison to avoid timing attacks.
  const expected = utf8Encode(account.passwordHash);
  const provided = utf8Encode(hash);
  if (expected.length !== provided.length || !crypto.subtle) {
    return jsonResponse(401, { error: "Invalid email or password." });
  }
  const expectedBytes = new Uint8Array(expected);
  const providedBytes = new Uint8Array(provided);
  let mismatch = 0;
  for (let i = 0; i < expectedBytes.length; i++) mismatch |= expectedBytes[i] ^ providedBytes[i];
  if (mismatch !== 0) return jsonResponse(401, { error: "Invalid email or password." });

  const session = await createSession(db, account.id);
  return jsonResponse(200, { user: { id: account.id, email: account.email }, token: session.token });
}

// ---- Sessions -------------------------------------------------------------

interface SessionRow {
  token: string;
  expires_at: string;
  account_id: number;
}

interface CreatedSession {
  token: string;
  expiresAt: string;
}

async function createSession(db: D1Database, accountId: number): Promise<CreatedSession> {
  const token = randomHex(SESSION_TOKEN_BYTES);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
  await db.prepare("INSERT INTO sessions (account_id, token, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)").bind(
    accountId,
    token,
    new Date().toISOString(),
    expiresAt,
  ).run();
  return { token, expiresAt };
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1];
  const cookie = request.headers.get("Cookie") ?? "";
  const cookieMatch = cookie.match(/(?:^|;\s*)rb_session=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
  return null;
}

export async function resolveSession(db: D1Database, token: string | null): Promise<SessionAccount | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await db
    .prepare("SELECT account_id, expires_at FROM sessions WHERE token = ?1 AND expires_at > ?2")
    .bind(token, new Date().toISOString())
    .first<SessionRow>();
  if (!row) return null;
  const account = await db.prepare("SELECT id, email FROM accounts WHERE id = ?1").bind(row.account_id).first<SessionAccount>();
  return (account ?? null) as SessionAccount | null;
}

export async function handleLogout(db: D1Database, token: string | null): Promise<Response> {
  if (token) {
    await db.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
  }
  return jsonResponse(200, { ok: true });
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// ---- Schema for reference (execute once against D1) -----------------------
// CREATE TABLE IF NOT EXISTS accounts (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   email TEXT NOT NULL UNIQUE,
//   password_hash TEXT NOT NULL,
//   salt_hex TEXT NOT NULL,
//   created_at TEXT NOT NULL
// );
// CREATE TABLE IF NOT EXISTS sessions (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   account_id INTEGER NOT NULL,
//   token TEXT NOT NULL UNIQUE,
//   created_at TEXT NOT NULL,
//   expires_at TEXT NOT NULL
// );
