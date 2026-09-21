import { db } from "@/db";
import { servers, serverNodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin, ApiError } from "@/lib/server/auth";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";
import { getNodeAgentInfo, listNodeSummaries } from "@/lib/server/nodes";
import { toNumber, isUuid } from "@/lib/server/admin-query";

/**
 * GET /api/admin/nodes
 *
 * Node inventory with allocation and derived health. The response also carries
 * `agent`, which explicitly reports that the remote node-agent control channel
 * is not implemented in this deployment, so the UI can show "Not configured"
 * instead of inventing hostnames/credentials.
 */
export async function GET() {
  return handleApi(async () => {
    await requireAdmin();
    const items = await listNodeSummaries();
    return ok({ items, agent: getNodeAgentInfo() });
  });
}

export async function POST(req: Request) {
  return handleApi(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const { name, region, ramCapacityMb, cpuCapacityCores, diskCapacityMb } = body as Record<string, unknown>;
    if (!name || !region) return fail(400, "Name and region are required.");

    const [node] = await db.insert(serverNodes).values({
      name: String(name),
      region: String(region),
      ramCapacityMb: Number(ramCapacityMb) || 8192,
      cpuCapacityCores: Number(cpuCapacityCores) || 4,
      diskCapacityMb: Number(diskCapacityMb) || 102400,
    }).returning();

    await logAudit({ userId: admin.id, action: "ADMIN_NODE_CREATED", metadata: { name } });
    return ok(node, 201);
  });
}

export async function PATCH(req: Request) {
  return handleApi(async () => {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const { nodeId, status } = body as { nodeId?: string; status?: string };
    if (!nodeId || !status) return fail(400, "Missing fields.");
    if (!["ONLINE", "OFFLINE", "MAINTENANCE"].includes(status)) return fail(400, "Invalid status.");

    await db.update(serverNodes).set({ status: status as "ONLINE" | "OFFLINE" | "MAINTENANCE" }).where(eq(serverNodes.id, nodeId));
    await logAudit({ userId: admin.id, action: "ADMIN_NODE_UPDATED", metadata: { nodeId, status } });
    return ok({ success: true });
  });
}

export async function DELETE(req: Request) {
  return handleApi(async () => {
    const admin = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const nodeId = searchParams.get("id");
    if (!nodeId) return fail(400, "Missing id.");
    if (!isUuid(nodeId)) return fail(400, "Invalid node id.");

    const [node] = await db.select().from(serverNodes).where(eq(serverNodes.id, nodeId)).limit(1);
    if (!node) throw new ApiError(404, "Node not found.");

    // `servers.node_id` has no cascade: deleting a node that still hosts
    // servers would raise a raw foreign-key error (a 500). Refuse cleanly so
    // admins are told exactly what to do instead.
    const [usage] = await db
      .select({ count: sql<number>`count(*)` })
      .from(servers)
      .where(eq(servers.nodeId, nodeId));
    const attached = toNumber(usage?.count);
    if (attached > 0) {
      throw new ApiError(
        409,
        `This node still hosts ${attached} server${attached === 1 ? "" : "s"}. Migrate or delete them before removing the node.`,
      );
    }

    await db.delete(serverNodes).where(eq(serverNodes.id, nodeId));
    await logAudit({ userId: admin.id, action: "ADMIN_NODE_DELETED", metadata: { nodeId, name: node.name } });
    return ok({ success: true });
  });
}
