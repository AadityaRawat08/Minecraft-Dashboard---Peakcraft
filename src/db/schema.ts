import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  bigserial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID());

export const userRoleEnum = pgEnum("user_role", ["USER", "SUPPORT", "ADMIN", "SUPER_ADMIN"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED"]);
export const serverStateEnum = pgEnum("server_state", [
  "CREATING",
  "STARTING",
  "RUNNING",
  "STOPPING",
  "STOPPED",
  "RESTARTING",
  "ERROR",
  "DELETING",
]);
export const serverSoftwareEnum = pgEnum("server_software", [
  "VANILLA",
  "PAPER",
  "SPIGOT",
  "PURPUR",
  "FABRIC",
  "FORGE",
  "NEOFORGE",
  "QUILT",
]);
export const nodeStatusEnum = pgEnum("node_status", ["ONLINE", "OFFLINE", "MAINTENANCE"]);
export const backupStatusEnum = pgEnum("backup_status", ["PENDING", "COMPLETED", "FAILED"]);
export const scheduleActionEnum = pgEnum("schedule_action", ["START", "STOP", "RESTART", "BACKUP", "COMMAND"]);
export const addonKindEnum = pgEnum("addon_kind", ["PLUGIN", "MOD"]);
export const consoleStreamEnum = pgEnum("console_stream", ["OUT", "IN", "SYSTEM"]);

export const users = pgTable("users", {
  id: id(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("USER"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  maxServers: integer("max_servers").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.email),
  usernameIdx: uniqueIndex("users_username_idx").on(table.username),
}));

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => ({
  tokenIdx: uniqueIndex("sessions_token_idx").on(table.tokenHash),
  userIdx: index("sessions_user_idx").on(table.userId),
}));

export const serverNodes = pgTable("server_nodes", {
  id: id(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  status: nodeStatusEnum("status").notNull().default("ONLINE"),
  ramCapacityMb: integer("ram_capacity_mb").notNull(),
  cpuCapacityCores: integer("cpu_capacity_cores").notNull(),
  diskCapacityMb: integer("disk_capacity_mb").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const servers = pgTable("servers", {
  id: id(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nodeId: uuid("node_id").notNull().references(() => serverNodes.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  mcVersion: text("mc_version").notNull(),
  software: serverSoftwareEnum("software").notNull(),
  state: serverStateEnum("state").notNull().default("CREATING"),
  stateChangedAt: timestamp("state_changed_at", { withTimezone: true }).notNull().defaultNow(),
  lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
  activeWorld: text("active_world").notNull().default("world"),
  ramMb: integer("ram_mb").notNull(),
  cpuCores: integer("cpu_cores").notNull(),
  storageMb: integer("storage_mb").notNull(),
  port: integer("port").notNull(),
  dataDir: text("data_dir").notNull(),
  motd: text("motd").notNull().default("A Peakcraft Server"),
  maxPlayers: integer("max_players").notNull().default(20),
  propertiesJson: jsonb("properties_json").notNull().default({}),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index("servers_owner_idx").on(table.ownerId),
}));

export const serverPlayers = pgTable("server_players", {
  id: id(),
  serverId: uuid("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  uuid: text("uuid").notNull(),
  online: boolean("online").notNull().default(false),
  whitelisted: boolean("whitelisted").notNull().default(false),
  opped: boolean("opped").notNull().default(false),
  banned: boolean("banned").notNull().default(false),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serverIdx: index("server_players_server_idx").on(table.serverId),
  uniquePlayer: uniqueIndex("server_players_unique_idx").on(table.serverId, table.uuid),
}));

export const catalogItems = pgTable("catalog_items", {
  id: id(),
  kind: addonKindEnum("kind").notNull(),
  name: text("name").notNull(),
  author: text("author").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  loader: text("loader").notNull().default("ANY"),
  supportedSoftware: jsonb("supported_software").notNull().default([]),
  latestVersion: text("latest_version").notNull(),
  homepage: text("homepage").notNull().default(""),
});

export const serverAddons = pgTable("server_addons", {
  id: id(),
  serverId: uuid("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  catalogItemId: uuid("catalog_item_id").notNull().references(() => catalogItems.id),
  kind: addonKindEnum("kind").notNull(),
  version: text("version").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serverIdx: index("server_addons_server_idx").on(table.serverId),
}));

export const serverBackups = pgTable("server_backups", {
  id: id(),
  serverId: uuid("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sizeBytes: numeric("size_bytes").notNull().default("0"),
  status: backupStatusEnum("status").notNull().default("PENDING"),
  mcVersion: text("mc_version").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serverIdx: index("server_backups_server_idx").on(table.serverId),
}));

export const scheduledTasks = pgTable("scheduled_tasks", {
  id: id(),
  serverId: uuid("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  action: scheduleActionEnum("action").notNull(),
  recurrence: jsonb("recurrence").notNull(),
  commandText: text("command_text"),
  retention: integer("retention"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serverIdx: index("scheduled_tasks_server_idx").on(table.serverId),
}));

export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  serverId: uuid("server_id").references(() => servers.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdIdx: index("audit_logs_created_idx").on(table.createdAt),
}));

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("notifications_user_idx").on(table.userId),
}));

export const consoleLines = pgTable("console_lines", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  serverId: uuid("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  stream: consoleStreamEnum("stream").notNull().default("OUT"),
  line: text("line").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serverIdx: index("console_lines_server_idx").on(table.serverId),
}));

export const metricSamples = pgTable("metric_samples", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  serverId: uuid("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  cpuPercent: numeric("cpu_percent").notNull().default("0"),
  ramMb: integer("ram_mb").notNull().default(0),
  playersOnline: integer("players_online").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serverIdx: index("metric_samples_server_idx").on(table.serverId),
}));

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
