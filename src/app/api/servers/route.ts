import { db } from "@/db";
import { servers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, ApiError } from "@/lib/server/auth";
import { ok, fail, handleApi } from "@/lib/server/http";
import { getProvider, MINECRAFT_VERSIONS, SERVER_SOFTWARE, REGIONS, type ServerSoftware } from "@/lib/minecraft/provider";
import { pickNodeWithCapacity, allocatePort } from "@/lib/server/access";
import { defaultProperties, serializeProperties } from "@/lib/minecraft/mock-provider";
import { logAudit, notify } from "@/lib/server/platform";
import fs from "fs";
import path from "path";

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    const rows = await db.select().from(servers).where(eq(servers.ownerId, user.id));
    return ok(rows);
  });
}

const RAM_MIN = 1024;
const RAM_MAX = 16384;
const CPU_MIN = 1;
const CPU_MAX = 8;
const STORAGE_MIN = 2048;
const STORAGE_MAX = 51200;

export async function POST(req: Request) {
  return handleApi(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { name, mcVersion, software, ramMb, cpuCores, storageMb, region } = body as Record<string, unknown>;

    if (!name || typeof name !== "string" || name.trim().length < 3 || name.trim().length > 40) {
      return fail(400, "Server name must be between 3 and 40 characters.");
    }
    if (!MINECRAFT_VERSIONS.includes(String(mcVersion))) return fail(400, "Unsupported Minecraft version.");
    if (!SERVER_SOFTWARE.some((s) => s.id === software)) return fail(400, "Unsupported server software.");
    if (!REGIONS.some((r) => r.id === region)) return fail(400, "Unsupported region.");

    const ram = Number(ramMb);
    const cpu = Number(cpuCores);
    const storage = Number(storageMb);
    if (!Number.isFinite(ram) || ram < RAM_MIN || ram > RAM_MAX) return fail(400, `RAM must be between ${RAM_MIN} and ${RAM_MAX} MB.`);
    if (!Number.isFinite(cpu) || cpu < CPU_MIN || cpu > CPU_MAX) return fail(400, `CPU must be between ${CPU_MIN} and ${CPU_MAX} cores.`);
    if (!Number.isFinite(storage) || storage < STORAGE_MIN || storage > STORAGE_MAX) return fail(400, `Storage must be between ${STORAGE_MIN} and ${STORAGE_MAX} MB.`);

    const existingCount = (await db.select().from(servers).where(eq(servers.ownerId, user.id))).length;
    if (existingCount >= user.maxServers) {
      throw new ApiError(403, `You have reached your limit of ${user.maxServers} servers.`);
    }

    const node = await pickNodeWithCapacity(String(region), ram, cpu, storage);
    const port = await allocatePort();

    const [server] = await db.insert(servers).values({
      ownerId: user.id,
      nodeId: node.id,
      name: name.trim(),
      mcVersion: String(mcVersion),
      software: software as ServerSoftware,
      state: "CREATING",
      ramMb: ram,
      cpuCores: cpu,
      storageMb: storage,
      port,
      dataDir: "",
      maxPlayers: 20,
    }).returning();

    const provider = getProvider();
    const { dataDir } = await provider.provision({
      serverId: server.id, name: server.name, mcVersion: server.mcVersion, software: server.software, motd: server.motd, maxPlayers: server.maxPlayers,
    });

    const props = defaultProperties({ mcVersion: server.mcVersion, motd: server.motd, maxPlayers: server.maxPlayers, port: server.port, levelName: "world" });
    fs.writeFileSync(path.join(dataDir, "server.properties"), serializeProperties(props));

    await db.update(servers).set({ dataDir, propertiesJson: props }).where(eq(servers.id, server.id));

    await logAudit({ userId: user.id, serverId: server.id, action: "SERVER_CREATED", metadata: { name: server.name, software, mcVersion } });
    await notify(user.id, "server.created", "Server created", `"${server.name}" is being provisioned.`);

    return ok({ ...server, dataDir, propertiesJson: props }, 201);
  });
}
