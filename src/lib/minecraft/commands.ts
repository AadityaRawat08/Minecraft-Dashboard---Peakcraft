import "server-only";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { consoleLines, servers, serverPlayers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { serverDataDir } from "@/lib/minecraft/mock-provider";

async function appendConsole(serverId: string, line: string, stream: "OUT" | "IN" | "SYSTEM" = "OUT") {
  await db.insert(consoleLines).values({ serverId, line, stream });
}

function writeJsonList(dataDir: string, file: string, list: unknown[]) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(list, null, 2) + "\n");
}

async function syncPlayerFiles(serverId: string) {
  const dataDir = serverDataDir(serverId);
  const players = await db.select().from(serverPlayers).where(eq(serverPlayers.serverId, serverId));
  writeJsonList(dataDir, "whitelist.json", players.filter((p) => p.whitelisted).map((p) => ({ uuid: p.uuid, name: p.username })));
  writeJsonList(dataDir, "ops.json", players.filter((p) => p.opped).map((p) => ({ uuid: p.uuid, name: p.username, level: 4 })));
  writeJsonList(dataDir, "banned-players.json", players.filter((p) => p.banned).map((p) => ({ uuid: p.uuid, name: p.username, reason: "Banned by an operator." })));
}

function fakeUuid(username: string): string {
  // Deterministic offline-mode style UUID derived from the username. Real
  // deployments would resolve this via the Mojang API (see players route).
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  const hex = hash.toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-${hex}${hex.slice(0, 4)}`.slice(0, 36);
}

export async function ensurePlayer(serverId: string, username: string) {
  const existing = await db.select().from(serverPlayers).where(and(eq(serverPlayers.serverId, serverId), eq(serverPlayers.username, username))).limit(1);
  if (existing.length > 0) return existing[0];
  let uuid = fakeUuid(username);
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = (await res.json()) as { id: string; name: string };
      uuid = data.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
    }
  } catch {
    // Offline / sandboxed network — fall back to the deterministic UUID.
  }
  const [row] = await db.insert(serverPlayers).values({ serverId, username, uuid }).returning();
  return row;
}

/**
 * Applies a Minecraft console command against the *simulated* server state.
 * This is intentionally isolated from any OS-level command execution
 * (PRD section 43) — it only ever mutates database rows and JSON files
 * inside the server's sandboxed directory.
 */
export async function applyConsoleCommand(serverId: string, rawCommand: string): Promise<void> {
  const command = rawCommand.trim().replace(/^\//, "");
  await appendConsole(serverId, `/${command}`, "IN");
  const [cmd, ...args] = command.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case "say": {
      await appendConsole(serverId, `[Server] ${args.join(" ")}`);
      break;
    }
    case "time": {
      await appendConsole(serverId, `Set the time to ${args[1] ?? args[0] ?? "day"}`);
      break;
    }
    case "whitelist": {
      const [sub, username] = args;
      if (sub === "add" && username) {
        const player = await ensurePlayer(serverId, username);
        await db.update(serverPlayers).set({ whitelisted: true }).where(eq(serverPlayers.id, player.id));
        await syncPlayerFiles(serverId);
        await appendConsole(serverId, `Added ${username} to the whitelist`);
      } else if (sub === "remove" && username) {
        await db.update(serverPlayers).set({ whitelisted: false }).where(and(eq(serverPlayers.serverId, serverId), eq(serverPlayers.username, username)));
        await syncPlayerFiles(serverId);
        await appendConsole(serverId, `Removed ${username} from the whitelist`);
      } else if (sub === "on") {
        await appendConsole(serverId, "Whitelist turned on");
      } else if (sub === "off") {
        await appendConsole(serverId, "Whitelist turned off");
      } else {
        await appendConsole(serverId, "Usage: /whitelist <add|remove|on|off> [player]");
      }
      break;
    }
    case "op": {
      const username = args[0];
      if (username) {
        const player = await ensurePlayer(serverId, username);
        await db.update(serverPlayers).set({ opped: true }).where(eq(serverPlayers.id, player.id));
        await syncPlayerFiles(serverId);
        await appendConsole(serverId, `Made ${username} a server operator`);
      }
      break;
    }
    case "deop": {
      const username = args[0];
      if (username) {
        await db.update(serverPlayers).set({ opped: false }).where(and(eq(serverPlayers.serverId, serverId), eq(serverPlayers.username, username)));
        await syncPlayerFiles(serverId);
        await appendConsole(serverId, `Made ${username} no longer a server operator`);
      }
      break;
    }
    case "kick": {
      const username = args[0];
      if (username) {
        await db.update(serverPlayers).set({ online: false }).where(and(eq(serverPlayers.serverId, serverId), eq(serverPlayers.username, username)));
        await appendConsole(serverId, `Kicked ${username}`);
      }
      break;
    }
    case "ban": {
      const username = args[0];
      if (username) {
        const player = await ensurePlayer(serverId, username);
        await db.update(serverPlayers).set({ banned: true, online: false }).where(eq(serverPlayers.id, player.id));
        await syncPlayerFiles(serverId);
        await appendConsole(serverId, `Banned ${username}`);
      }
      break;
    }
    case "pardon": {
      const username = args[0];
      if (username) {
        await db.update(serverPlayers).set({ banned: false }).where(and(eq(serverPlayers.serverId, serverId), eq(serverPlayers.username, username)));
        await syncPlayerFiles(serverId);
        await appendConsole(serverId, `Unbanned ${username}`);
      }
      break;
    }
    case "gamemode": {
      await appendConsole(serverId, `Set game mode to ${args[0] ?? "survival"} for ${args[1] ?? "player"}`);
      break;
    }
    case "weather": {
      await appendConsole(serverId, `Changing to ${args[0] ?? "clear"}`);
      break;
    }
    case "stop": {
      await appendConsole(serverId, "Use the Stop button in the Overview tab to stop this server.");
      break;
    }
    case "help": {
      await appendConsole(serverId, "Available: say, time, whitelist, op, deop, kick, ban, pardon, gamemode, weather");
      break;
    }
    default: {
      await appendConsole(serverId, `Unknown or unsupported command: ${cmd}`);
    }
  }

  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (server) await db.update(servers).set({ updatedAt: new Date() }).where(eq(servers.id, serverId));
}
