import "server-only";
import { cookies, headers } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

export const SESSION_COOKIE = "peakcraft_session";
const SESSION_DAYS = 30;

export type Role = "USER" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN";

export const PERMISSIONS: Record<Role, string[]> = {
  USER: [
    "server.read", "server.start", "server.stop", "server.delete",
    "server.files.read", "server.files.write", "server.backups.create", "server.backups.restore",
  ],
  SUPPORT: [
    "server.read", "server.start", "server.stop",
    "admin.users.read", "admin.servers.read",
  ],
  ADMIN: [
    "server.read", "server.start", "server.stop", "server.delete",
    "admin.users.manage", "admin.servers.manage", "admin.nodes.manage",
  ],
  SUPER_ADMIN: ["*"],
};

export function hasPermission(role: Role, permission: string): boolean {
  const perms = PERMISSIONS[role] ?? [];
  return perms.includes("*") || perms.includes(permission);
}

export function isAdminRole(role: Role): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: string, remember = true) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const hdrs = await headers();
  const expiresAt = new Date(Date.now() + (remember ? SESSION_DAYS : 1) * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    userAgent: hdrs.get("user-agent") ?? "unknown",
    ip: hdrs.get("x-forwarded-for") ?? "127.0.0.1",
    expiresAt,
  });

  const cookieStore = await cookies();
  // Allow deployments behind plain HTTP (e.g. local preview) to override the
  // Secure flag via COOKIE_SECURE. Default: Secure only in production.
  const cookieSecure = process.env.COOKIE_SECURE === "true"
    || (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  maxServers: number;
  createdAt: Date;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (rows.length === 0) return null;

  db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash)).catch(() => {});

  const { user } = rows[0];
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as Role,
    status: user.status,
    maxServers: user.maxServers,
    createdAt: user.createdAt,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Authentication required.");
  if (user.status === "SUSPENDED") throw new ApiError(403, "Your account has been suspended.");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) throw new ApiError(403, "Administrator access required.");
  return user;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function passwordStrengthError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
