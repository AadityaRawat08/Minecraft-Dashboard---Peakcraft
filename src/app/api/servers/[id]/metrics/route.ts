import "server-only";
import { db } from "@/db";
import { metricSamples } from "@/db/schema";
import { and, asc, eq, gte } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, handleApi } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const { searchParams } = new URL(req.url);
    const minutes = Number(searchParams.get("minutes") || 20);
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const samples = await db.select().from(metricSamples)
      .where(and(eq(metricSamples.serverId, id), gte(metricSamples.createdAt, since)))
      .orderBy(asc(metricSamples.createdAt));
    return ok({ series: samples.map((s) => ({ time: s.createdAt.toISOString(), cpu: Number(s.cpuPercent), ram: s.ramMb, players: s.playersOnline })) });
  });
}
