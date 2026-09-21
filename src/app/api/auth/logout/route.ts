import { destroySession, getCurrentUser } from "@/lib/server/auth";
import { ok, handleApi } from "@/lib/server/http";
import { logAudit, clientIp } from "@/lib/server/platform";

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await getCurrentUser();
    await destroySession();
    if (user) await logAudit({ userId: user.id, action: "LOGOUT", ip: clientIp(req.headers) });
    return ok({ success: true });
  });
}
