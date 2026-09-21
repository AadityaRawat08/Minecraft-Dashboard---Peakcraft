import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import {
  createSession, hashPassword, isValidEmail, isValidUsername, passwordStrengthError, ApiError,
} from "@/lib/server/auth";
import { fail, ok, handleApi } from "@/lib/server/http";
import { logAudit, rateLimit, clientIp } from "@/lib/server/platform";

export async function POST(req: Request) {
  return handleApi(async () => {
    const hdrs = req.headers;
    const ip = clientIp(hdrs);
    const limit = rateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
    if (!limit.allowed) throw new ApiError(429, "Too many registration attempts. Please try again later.");

    const body = await req.json().catch(() => null);
    if (!body) return fail(400, "Invalid request body.");
    const { username, email, password, confirmPassword } = body as Record<string, string>;

    if (!username || !email || !password || !confirmPassword) {
      return fail(400, "All fields are required.");
    }
    if (!isValidUsername(username)) {
      return fail(400, "Username must be 3-20 characters (letters, numbers, underscore only).");
    }
    if (!isValidEmail(email)) {
      return fail(400, "Please enter a valid email address.");
    }
    if (password !== confirmPassword) {
      return fail(400, "Passwords do not match.");
    }
    const strengthError = passwordStrengthError(password);
    if (strengthError) return fail(400, strengthError);

    const existing = await db.select().from(users).where(or(eq(users.email, email.toLowerCase()), eq(users.username, username))).limit(1);
    if (existing.length > 0) {
      return fail(409, "An account with that email or username already exists.");
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(users).values({
      username,
      email: email.toLowerCase(),
      passwordHash,
    }).returning();

    await createSession(user.id, true);
    await logAudit({ userId: user.id, action: "USER_CREATED", ip });

    return ok({ id: user.id, username: user.username, email: user.email, role: user.role }, 201);
  });
}
