import "server-only";
import { db } from "@/db";
import { metricSamples } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";
import { getProvider } from "@/lib/minecraft/provider";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    const now = new Date();
    const uptimeMs = server.lastStartedAt ? now.getTime() - new Date(server.lastStartedAt).getTime() : 0;
    const [latestMetric] = await db.select().from(metricSamples).where(eq(metricSamples.serverId, id)).orderBy(desc(metricSamples.createdAt)).limit(1);
    return ok({ state: server.state, uptimeMs: Math.max(0, uptimeMs),
      resources: { cpuPercent: latestMetric ? Number(latestMetric.cpuPercent) : 0, ramMb: latestMetric?.ramMb ?? Math.round(server.ramMb * 0.4), ramMaxMb: server.ramMb, diskUsedMb: 0, diskMaxMb: server.storageMb },
      players: { online: latestMetric?.playersOnline ?? 0, max: server.maxPlayers },
      address: { host: "localhost", port: server.port } });
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: string };
    if (!action) return fail(400, "Missing action.");
    const provider = getProvider();
    // The provider owns the lifecycle state transition (it writes the new
    // state plus the matching console output), so the route only validates
    // the current state and delegates. Writing the state here as well would
    // make the provider reject the server as "already transitioning".
    switch (action) {
      case "START": if (server.state !== "STOPPED" && server.state !== "ERROR") return fail(400, "Cannot start server in current state."); await provider.start(id); break;
      case "STOP": if (server.state !== "RUNNING" && server.state !== "STARTING") return fail(400, "Cannot stop server in current state."); await provider.stop(id); break;
      case "RESTART": if (server.state !== "RUNNING") return fail(400, "Cannot restart server in current state."); await provider.restart(id); break;
      case "KILL": if (server.state === "STOPPED") return fail(400, "Server is already stopped."); await provider.kill(id); break;
      default: return fail(400, "Unknown action.");
    }
    await logAudit({ userId: user.id, serverId: id, action: "SERVER_" + action + "_REQUESTED" });
    return ok({ success: true });
  });
}