import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { requireUser, SESSION_COOKIE } from "@/lib/server/auth";
import { ok, handleApi } from "@/lib/server/http";
import crypto from "crypto";

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE)?.value;
    const currentHash = currentToken ? crypto.createHash("sha256").update(currentToken).digest("hex") : null;

    const rows = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    return ok(rows.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      current: s.tokenHash === currentHash,
    })));
  });
}

export async function DELETE(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const scope = searchParams.get("scope");
    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE)?.value;
    const currentHash = currentToken ? crypto.createHash("sha256").update(currentToken).digest("hex") : null;

    if (scope === "others" && currentHash) {
      await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, currentHash)));
    } else if (id) {
      await db.delete(sessions).where(and(eq(sessions.userId, user.id), eq(sessions.id, id)));
    }
    return ok({ success: true });
  });
}
