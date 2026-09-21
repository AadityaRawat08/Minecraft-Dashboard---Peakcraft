import "server-only";
import { db } from "@/db";
import { servers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/server/auth";
import { getServerForUser } from "@/lib/server/access";
import { ok, fail, handleApi } from "@/lib/server/http";
import { logAudit } from "@/lib/server/platform";

type Ctx = { params: Promise<{ id: string }> };

const PROPERTY_SCHEMA = [
  { key: "gamemode", label: "Game Mode", type: "enum", options: ["survival", "creative", "adventure", "spectator"], group: "Gameplay" },
  { key: "difficulty", label: "Difficulty", type: "enum", options: ["peaceful", "easy", "normal", "hard"], group: "Gameplay" },
  { key: "pvp", label: "PVP", type: "boolean", group: "Gameplay" },
  { key: "max-players", label: "Max Players", type: "number", min: 1, max: 200, group: "Gameplay" },
  { key: "view-distance", label: "View Distance", type: "number", min: 2, max: 32, group: "Performance" },
  { key: "simulation-distance", label: "Simulation Distance", type: "number", min: 2, max: 32, group: "Performance" },
  { key: "online-mode", label: "Online Mode", type: "boolean", group: "Security" },
  { key: "white-list", label: "Whitelist", type: "boolean", group: "Security" },
  { key: "spawn-protection", label: "Spawn Protection", type: "number", min: 0, max: 64, group: "Security" },
  { key: "motd", label: "Message of the Day", type: "text", group: "General" },
];

export async function GET(_req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    const server = await getServerForUser(user, id);
    const props = server.propertiesJson && typeof server.propertiesJson === "object" ? server.propertiesJson : {};
    return ok({ properties: props, schema: PROPERTY_SCHEMA });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handleApi(async () => {
    const user = await requireUser();
    const { id } = await params;
    await getServerForUser(user, id);
    const body = await req.json().catch(() => ({}));
    const { properties } = body as { properties?: Record<string, string> };
    if (!properties) return fail(400, "Missing properties.");
    const restartRequired = properties["gamemode"] !== undefined || properties["difficulty"] !== undefined;
    await db.update(servers).set({ propertiesJson: properties, updatedAt: new Date() }).where(eq(servers.id, id));
    await logAudit({ userId: user.id, serverId: id, action: "PROPERTIES_UPDATED" });
    return ok({ success: true, restartRequired });
  });
}
