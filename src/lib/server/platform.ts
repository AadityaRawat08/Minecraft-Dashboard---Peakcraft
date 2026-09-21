import "server-only";
import { db } from "@/db";
import { auditLogs, notifications } from "@/db/schema";

export async function logAudit(params: {
  userId?: string | null;
  serverId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      serverId: params.serverId ?? null,
      action: params.action,
      metadata: params.metadata ?? {},
      ip: params.ip ?? null,
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

export async function notify(userId: string, type: string, title: string, message: string) {
  try {
    await db.insert(notifications).values({ userId, type, title, message });
  } catch (err) {
    console.error("notify failed", err);
  }
}

// In-memory sliding window rate limiter. Designed to be swapped for a
// Redis-backed limiter (see PRD section 45/26) without changing call sites.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export function clientIp(headersList: Headers): string {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
}
