import "server-only";
// Provider/adapter architecture (PRD section 2 & 31).
//
//   MinecraftServerProvider
//   ├── DevelopmentMockProvider  (active — realistic simulation + real filesystem)
//   ├── LocalDockerProvider      (future — provisions real Docker containers)
//   └── FutureCloudProvider      (future — remote node agents over a secure channel)
//
// The rest of the application (API routes, scheduler) only depends on this
// interface, so swapping the runtime provider never requires touching
// application code — only `getProvider()` below.

export type { ServerState, ServerSoftware } from "@/lib/minecraft/catalog";
export { MINECRAFT_VERSIONS, SERVER_SOFTWARE, REGIONS, softwareMeta } from "@/lib/minecraft/catalog";
import type { ServerSoftware } from "@/lib/minecraft/catalog";

export interface ProvisionInput {
  serverId: string;
  name: string;
  mcVersion: string;
  software: ServerSoftware;
  motd: string;
  maxPlayers: number;
}

export interface MinecraftServerProvider {
  provision(input: ProvisionInput): Promise<{ dataDir: string }>;
  start(serverId: string): Promise<void>;
  stop(serverId: string): Promise<void>;
  restart(serverId: string): Promise<void>;
  kill(serverId: string): Promise<void>;
  destroy(serverId: string): Promise<void>;
  sendCommand(serverId: string, command: string): Promise<void>;
}

let providerInstance: MinecraftServerProvider | null = null;

export function getProvider(): MinecraftServerProvider {
  if (!providerInstance) {
    providerInstance = new DevelopmentMockProvider();
  }
  return providerInstance;
}

// Imported at the bottom to avoid a circular-import evaluation issue: the
// mock provider imports types from this module but the class itself is only
// instantiated lazily above, after both modules have finished loading.
import { DevelopmentMockProvider } from "@/lib/minecraft/mock-provider";
