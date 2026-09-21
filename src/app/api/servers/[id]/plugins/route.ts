import "server-only";
import { db } from "@/db";
import { serverAddons, catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";
import { softwareMeta } from "@/lib/minecraft/catalog";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    const { searchParams } = new URL(req.url);
    const rawKind = searchParams.get("kind") || "PLUGIN";
    const kind = (rawKind === "MOD" ? "MOD" : "PLUGIN") as "PLUGIN" | "MOD";
    const meta = softwareMeta(server.software);
    const supported = kind === "PLUGIN" ? meta.supportsPlugins : meta.supportsMods;
    const installed = await db.select().from(serverAddons).where(eq(serverAddons.serverId, id));
    const catalog = await db.select().from(catalogItems).where(eq(catalogItems.kind, kind));
    return ok({
      supported,
      software: server.software,
      catalog: catalog.map((c) => ({ ...c, compatible: supported })),
      installed: installed.map((i) => ({
        id: i.id, version: i.version, enabled: i.enabled,
        item: { ...catalog.find((c) => c.id === i.catalogItemId), compatible: supported },
      })),
    });
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { catalogItemId } = body as { catalogItemId?: string };
    if (!catalogItemId) return fail(400, "Missing catalogItemId.");
    const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, catalogItemId)).limit(1);
    if (!item) return fail(404, "Catalog item not found.");
    await db.insert(serverAddons).values({ serverId: id, catalogItemId, kind: item.kind, version: item.latestVersion, enabled: true });
    await logAudit({ userId: user.id, serverId: id, action: "ADDON_INSTALLED", metadata: { name: item.name } });
    return ok({ success: true });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { addonId, enabled } = body as { addonId?: string; enabled?: boolean };
    if (!addonId) return fail(400, "Missing addonId.");
    await db.update(serverAddons).set({ enabled: !!enabled }).where(eq(serverAddons.id, addonId));
    return ok({ success: true });
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const { searchParams } = new URL(req.url);
    const addonId = searchParams.get("id");
    if (!addonId) return fail(400, "Missing id.");
    await db.delete(serverAddons).where(eq(serverAddons.id, addonId));
    return ok({ success: true });
  });
}
