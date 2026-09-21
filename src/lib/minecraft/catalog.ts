// Pure, client-safe reference data & types. This module must never import
// server-only code (database, "server-only") so it can be shared by both
// server and client components (e.g. the create-server wizard, settings page).

export type ServerState =
  | "CREATING" | "STARTING" | "RUNNING" | "STOPPING" | "STOPPED" | "RESTARTING" | "ERROR" | "DELETING";

export type ServerSoftware =
  | "VANILLA" | "PAPER" | "SPIGOT" | "PURPUR" | "FABRIC" | "FORGE" | "NEOFORGE" | "QUILT";

export const MINECRAFT_VERSIONS = [
  "1.21.4", "1.21.3", "1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.1", "1.19.4", "1.18.2", "1.16.5",
];

export const SERVER_SOFTWARE: Array<{
  id: ServerSoftware;
  label: string;
  supportsPlugins: boolean;
  supportsMods: boolean;
  loader?: string;
  description: string;
}> = [
  { id: "VANILLA", label: "Vanilla", supportsPlugins: false, supportsMods: false, description: "Official Mojang server software with no modifications." },
  { id: "PAPER", label: "Paper", supportsPlugins: true, supportsMods: false, description: "High-performance Bukkit-based server with plugin support." },
  { id: "SPIGOT", label: "Spigot", supportsPlugins: true, supportsMods: false, description: "Widely-used Bukkit fork with broad plugin compatibility." },
  { id: "PURPUR", label: "Purpur", supportsPlugins: true, supportsMods: false, description: "Paper fork with additional gameplay features and flags." },
  { id: "FABRIC", label: "Fabric", supportsPlugins: false, supportsMods: true, loader: "FABRIC", description: "Lightweight modding toolchain, ideal for performance mods." },
  { id: "FORGE", label: "Forge", supportsPlugins: false, supportsMods: true, loader: "FORGE", description: "The long-standing modding platform with the largest mod ecosystem." },
  { id: "NEOFORGE", label: "NeoForge", supportsPlugins: false, supportsMods: true, loader: "NEOFORGE", description: "Community-driven continuation of Forge." },
  { id: "QUILT", label: "Quilt", supportsPlugins: false, supportsMods: true, loader: "QUILT", description: "Fabric-compatible modding toolchain focused on modularity." },
];

export const REGIONS: Array<{ id: string; label: string }> = [
  { id: "india", label: "India" },
  { id: "singapore", label: "Singapore" },
  { id: "europe", label: "Europe" },
  { id: "north-america", label: "North America" },
];

export function softwareMeta(software: ServerSoftware) {
  return SERVER_SOFTWARE.find((s) => s.id === software)!;
}
