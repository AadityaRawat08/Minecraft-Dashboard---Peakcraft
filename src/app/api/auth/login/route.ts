import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { createSession, verifyPassword, ApiError } from "@/lib/server/auth";
import { fail, ok, handleApi } from "@/lib/server/http";
import { logAudit, rateLimit, clientIp } from "@/lib/server/platform";

export async function POST(req: Request) {
  return handleApi(async () => {
    const ip = clientIp(req.headers);
    const limit = rateLimit(`login:${ip}`, 10, 10 * 60 * 1000);
    if (!limit.allowed) throw new ApiError(429, "Too many login attempts. Please try again later.");

    const body = await req.json().catch(() => null);
    if (!body) return fail(400, "Invalid request body.");
    const { identifier, password, remember } = body as Record<string, unknown>;
    if (!identifier || !password) return fail(400, "Email/username and password are required.");

    const idStr = String(identifier).toLowerCase();
    const [user] = await db.select().from(users).where(or(eq(users.email, idStr), eq(users.username, String(identifier)))).limit(1);

    if (!user) {
      await logAudit({ action: "LOGIN_FAILED", ip, metadata: { identifier: idStr } });
      return fail(401, "Invalid credentials.");
    }
    const valid = await verifyPassword(String(password), user.passwordHash);
    if (!valid) {
      await logAudit({ userId: user.id, action: "LOGIN_FAILED", ip });
      return fail(401, "Invalid credentials.");
    }
    if (user.status === "SUSPENDED") {
      return fail(403, "Your account has been suspended. Contact support for assistance.");
    }

    await createSession(user.id, Boolean(remember ?? true));
    await logAudit({ userId: user.id, action: "LOGIN", ip });

    return ok({ id: user.id, username: user.username, email: user.email, role: user.role });
  });
}
