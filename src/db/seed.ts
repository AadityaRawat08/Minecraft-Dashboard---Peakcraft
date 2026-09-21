import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  users, serverNodes, servers, catalogItems, serverPlayers, scheduledTasks, platformSettings,
} from "./schema";

// Inline the provisioning logic that DevelopmentMockProvider normally does,
// because that module (and the scheduler) import "server-only" which throws
// when run outside a Next.js server context.
const STORAGE_ROOT = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.resolve(process.cwd(), "data", "servers");

function serverDataDir(serverId: string): string {
  return path.join(STORAGE_ROOT, serverId);
}

function provision(dataDir: string, input: { name: string; mcVersion: string; software: string }) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, "world"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "logs"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "plugins"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "mods"), { recursive: true });
  fs.writeFileSync(path.join(dataDir, "eula.txt"), "eula=true\n");
  fs.writeFileSync(path.join(dataDir, "whitelist.json"), "[]\n");
  fs.writeFileSync(path.join(dataDir, "ops.json"), "[]\n");
  fs.writeFileSync(path.join(dataDir, "banned-players.json"), "[]\n");
  fs.writeFileSync(path.join(dataDir, "banned-ips.json"), "[]\n");
  fs.writeFileSync(
    path.join(dataDir, "world", "level.dat.txt"),
    `This is a placeholder for the ${input.mcVersion} world save data managed by the ${input.name} server.\n`,
  );
  fs.writeFileSync(path.join(dataDir, "logs", "latest.log"), `[${new Date().toISOString()}] [Server thread/INFO]: Provisioning ${input.name}\n`);
}

function nextIntervalRun(hours: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

async function main() {
  console.log("Seeding Peakcraft Panel database...");

  await db.delete(scheduledTasks);
  await db.delete(serverPlayers);
  await db.delete(servers);
  await db.delete(serverNodes);
  await db.delete(catalogItems);
  await db.delete(users);
  await db.delete(platformSettings);

  const adminPasswordHash = await bcrypt.hash("AdminPass123", 12);
  const demoPasswordHash = await bcrypt.hash("DemoPass123", 12);

  const [admin] = await db.insert(users).values({
    username: "admin",
    email: "admin@example.com",
    passwordHash: adminPasswordHash,
    role: "SUPER_ADMIN",
    maxServers: 100,
  }).returning();

  const [demo] = await db.insert(users).values({
    username: "demo",
    email: "demo@example.com",
    passwordHash: demoPasswordHash,
    role: "USER",
    maxServers: 3,
  }).returning();

  const nodeRows = await db.insert(serverNodes).values([
    { name: "peak-in-01", region: "india", status: "ONLINE", ramCapacityMb: 32768, cpuCapacityCores: 16, diskCapacityMb: 512000 },
    { name: "peak-sg-01", region: "singapore", status: "ONLINE", ramCapacityMb: 32768, cpuCapacityCores: 16, diskCapacityMb: 512000 },
    { name: "peak-eu-01", region: "europe", status: "ONLINE", ramCapacityMb: 65536, cpuCapacityCores: 32, diskCapacityMb: 1024000 },
    { name: "peak-na-01", region: "north-america", status: "ONLINE", ramCapacityMb: 65536, cpuCapacityCores: 32, diskCapacityMb: 1024000 },
  ]).returning();

  await db.insert(catalogItems).values([
    { kind: "PLUGIN", name: "EssentialsX", author: "EssentialsX Team", description: "Core commands, homes, warps, kits and more.", category: "Core", loader: "ANY", supportedSoftware: ["PAPER", "SPIGOT", "PURPUR"], latestVersion: "2.20.1", homepage: "https://essentialsx.net" },
    { kind: "PLUGIN", name: "WorldEdit", author: "EngineHub", description: "In-game map editor for fast building.", category: "Tools", loader: "ANY", supportedSoftware: ["PAPER", "SPIGOT", "PURPUR"], latestVersion: "7.3.0", homepage: "https://enginehub.org/worldedit" },
    { kind: "PLUGIN", name: "LuckPerms", author: "Luck", description: "Advanced permissions management.", category: "Administration", loader: "ANY", supportedSoftware: ["PAPER", "SPIGOT", "PURPUR"], latestVersion: "5.4.130", homepage: "https://luckperms.net" },
    { kind: "PLUGIN", name: "Vault", author: "Vault Team", description: "Permissions, chat & economy API bridge.", category: "API", loader: "ANY", supportedSoftware: ["PAPER", "SPIGOT", "PURPUR"], latestVersion: "1.7.3", homepage: "https://github.com/MilkBowl/Vault" },
    { kind: "PLUGIN", name: "ViaVersion", author: "ViaVersion Team", description: "Allows newer clients to join older server versions.", category: "Compatibility", loader: "ANY", supportedSoftware: ["PAPER", "SPIGOT", "PURPUR"], latestVersion: "5.1.1", homepage: "https://viaversion.com" },
    { kind: "MOD", name: "Sodium", author: "CaffeineMC", description: "Modern rendering engine that greatly improves performance.", category: "Performance", loader: "FABRIC", supportedSoftware: ["FABRIC", "QUILT"], latestVersion: "0.5.11", homepage: "https://modrinth.com/mod/sodium" },
    { kind: "MOD", name: "JEI", author: "mezz", description: "Just Enough Items — item and recipe viewing mod.", category: "Utility", loader: "FORGE", supportedSoftware: ["FORGE", "NEOFORGE"], latestVersion: "19.5.0", homepage: "https://curseforge.com/minecraft/mc-mods/jei" },
    { kind: "MOD", name: "Create", author: "Simibubi", description: "Building tools and contraptions themed around mechanical engineering.", category: "Technology", loader: "FORGE", supportedSoftware: ["FORGE", "NEOFORGE"], latestVersion: "6.0.4", homepage: "https://createmod.net" },
    { kind: "MOD", name: "Applied Energistics 2", author: "AlgorithmX2", description: "Digital storage and automation.", category: "Technology", loader: "FORGE", supportedSoftware: ["FORGE", "NEOFORGE", "FABRIC"], latestVersion: "15.5.5", homepage: "https://ae2.fandom.com" },
    { kind: "MOD", name: "Iron Chests", author: "ProgWML6", description: "Adds new tiers of storage chests.", category: "Storage", loader: "FORGE", supportedSoftware: ["FORGE", "NEOFORGE"], latestVersion: "14.4.4", homepage: "https://curseforge.com/minecraft/mc-mods/iron-chests" },
  ]);

  const [survival] = await db.insert(servers).values({
    ownerId: demo.id,
    nodeId: nodeRows[0].id,
    name: "Survival Server",
    description: "A cozy survival world for friends.",
    mcVersion: "1.21.1",
    software: "PAPER",
    state: "CREATING",
    ramMb: 4096,
    cpuCores: 2,
    storageMb: 10240,
    port: 25565,
    dataDir: "",
    motd: "Welcome to the Survival Server!",
    maxPlayers: 20,
  }).returning();

  const [creative] = await db.insert(servers).values({
    ownerId: demo.id,
    nodeId: nodeRows[1].id,
    name: "Creative Server",
    description: "Unlimited resources, unlimited imagination.",
    mcVersion: "1.20.6",
    software: "VANILLA",
    state: "CREATING",
    ramMb: 2048,
    cpuCores: 1,
    storageMb: 5120,
    port: 25566,
    dataDir: "",
    motd: "Creative Server - Build anything!",
    maxPlayers: 10,
  }).returning();

  for (const srv of [survival, creative]) {
    const dataDir = serverDataDir(srv.id);
    provision(dataDir, { name: srv.name, mcVersion: srv.mcVersion, software: srv.software });
    await db.update(servers).set({ dataDir, state: "STOPPED" }).where(eq(servers.id, srv.id));
  }

  await db.insert(serverPlayers).values([
    { serverId: survival.id, username: "Notch", uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5", whitelisted: true, opped: true },
    { serverId: survival.id, username: "Steve", uuid: "8667ba71-b85a-4004-af54-457a9734eed7", whitelisted: true },
  ]);

  const recurrence = { type: "interval", hours: 12 } as const;
  await db.insert(scheduledTasks).values({
    serverId: survival.id,
    action: "BACKUP",
    recurrence,
    retention: 7,
    nextRunAt: nextIntervalRun(12),
  });

  await db.insert(platformSettings).values({ key: "maintenanceMode", value: { enabled: false } });

  console.log("Seed complete.");
  console.log("Admin login: admin@example.com / AdminPass123");
  console.log("Demo login:  demo@example.com / DemoPass123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
