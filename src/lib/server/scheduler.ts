import "server-only";
import fs from "fs";
import { db } from "@/db";
import { servers, consoleLines, metricSamples, scheduledTasks, serverPlayers } from "@/db/schema";
import { and, eq, lte, or } from "drizzle-orm";
import { serverDataDir } from "@/lib/minecraft/mock-provider";
import { applyConsoleCommand } from "@/lib/minecraft/commands";
import { createBackup, pruneOldBackups } from "@/lib/minecraft/backup";
import { notify, logAudit } from "@/lib/server/platform";

const TICK_MS = 2000;
const STARTING_DURATION_MS = 4000;
const STOPPING_DURATION_MS = 2500;
const CREATING_DURATION_MS = 2500;

let started = false;

function dirSizeBytes(dir: string): number {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = `${current}/${entry.name}`;
      if (entry.isDirectory()) stack.push(full);
      else total += fs.statSync(full).size;
    }
  }
  return total;
}

type Recurrence =
  | { type: "interval"; hours: number }
  | { type: "daily"; time: string }
  | { type: "weekly"; day: number; time: string };

export function computeNextRun(recurrence: Recurrence, from: Date = new Date()): Date {
  const next = new Date(from);
  if (recurrence.type === "interval") {
    next.setTime(from.getTime() + recurrence.hours * 60 * 60 * 1000);
    return next;
  }
  const [h, m] = recurrence.time.split(":").map(Number);
  next.setHours(h, m, 0, 0);
  if (recurrence.type === "daily") {
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }
  // weekly
  const targetDay = recurrence.day;
  while (next.getDay() !== targetDay || next <= from) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

async function tickLifecycle() {
  const now = new Date();
  const all = await db.select().from(servers);

  for (const server of all) {
    const age = now.getTime() - new Date(server.stateChangedAt).getTime();

    if (server.state === "CREATING" && age > CREATING_DURATION_MS) {
      await db.update(servers).set({ state: "STOPPED", stateChangedAt: now, updatedAt: now }).where(eq(servers.id, server.id));
      await db.insert(consoleLines).values({ serverId: server.id, line: "Provisioning complete. Server is ready to start.", stream: "SYSTEM" });
    } else if (server.state === "STARTING" && age > STARTING_DURATION_MS) {
      await db.update(servers).set({ state: "RUNNING", stateChangedAt: now, updatedAt: now }).where(eq(servers.id, server.id));
      await db.insert(consoleLines).values([
        { serverId: server.id, line: `Loading world "${server.activeWorld}"...` },
        { serverId: server.id, line: `Done! Type "help" for a list of commands.` },
      ]);
      await notify(server.ownerId, "server.started", "Server started", `"${server.name}" is now online.`);
    } else if (server.state === "STOPPING" && age > STOPPING_DURATION_MS) {
      await db.update(servers).set({ state: "STOPPED", stateChangedAt: now, updatedAt: now }).where(eq(servers.id, server.id));
      await db.insert(consoleLines).values({ serverId: server.id, line: "Server stopped.", stream: "SYSTEM" });
      await notify(server.ownerId, "server.stopped", "Server stopped", `"${server.name}" has been stopped.`);
    } else if (server.state === "RESTARTING" && age > STARTING_DURATION_MS) {
      await db.update(servers).set({ state: "RUNNING", stateChangedAt: now, updatedAt: now }).where(eq(servers.id, server.id));
      await db.insert(consoleLines).values({ serverId: server.id, line: `Done! Type "help" for a list of commands.` });
      await notify(server.ownerId, "server.started", "Server restarted", `"${server.name}" is back online.`);
    } else if (server.state === "RUNNING") {
      const cpu = Math.min(99, Math.max(3, 12 + Math.random() * (server.cpuCores * 22)));
      const ramUsed = Math.min(server.ramMb, Math.round(server.ramMb * (0.35 + Math.random() * 0.35)));
      const playersOnline = (await db.select().from(serverPlayers).where(and(eq(serverPlayers.serverId, server.id), eq(serverPlayers.online, true)))).length;
      await db.insert(metricSamples).values({ serverId: server.id, cpuPercent: cpu.toFixed(2), ramMb: ramUsed, playersOnline });
      if (Math.random() < 0.08) {
        const flavor = [
          "Saved the game",
          "Ticking entities took longer than expected",
          `Autosave complete for world "${server.activeWorld}"`,
        ];
        await db.insert(consoleLines).values({ serverId: server.id, line: flavor[Math.floor(Math.random() * flavor.length)] });
      }
    }
  }
}

async function tickSchedules() {
  const now = new Date();
  const due = await db.select().from(scheduledTasks).where(and(eq(scheduledTasks.enabled, true), lte(scheduledTasks.nextRunAt, now)));

  for (const task of due) {
    try {
      const [server] = await db.select().from(servers).where(eq(servers.id, task.serverId)).limit(1);
      if (server) {
        switch (task.action) {
          case "START":
            if (server.state === "STOPPED") {
              await db.update(servers).set({ state: "STARTING", stateChangedAt: now, lastStartedAt: now }).where(eq(servers.id, server.id));
            }
            break;
          case "STOP":
            if (server.state === "RUNNING") {
              await db.update(servers).set({ state: "STOPPING", stateChangedAt: now }).where(eq(servers.id, server.id));
            }
            break;
          case "RESTART":
            if (server.state === "RUNNING") {
              await db.update(servers).set({ state: "RESTARTING", stateChangedAt: now }).where(eq(servers.id, server.id));
            }
            break;
          case "BACKUP":
            await createBackup(server.id, `Scheduled backup ${now.toLocaleString()}`);
            if (task.retention) await pruneOldBackups(server.id, task.retention);
            break;
          case "COMMAND":
            if (task.commandText && server.state === "RUNNING") {
              await applyConsoleCommand(server.id, task.commandText);
            }
            break;
        }
        await logAudit({ userId: server.ownerId, serverId: server.id, action: `SCHEDULE_${task.action}_EXECUTED` });
      }
    } catch (err) {
      console.error("scheduled task failed", task.id, err);
    } finally {
      const recurrence = task.recurrence as Recurrence;
      await db.update(scheduledTasks).set({ lastRunAt: now, nextRunAt: computeNextRun(recurrence, now) }).where(eq(scheduledTasks.id, task.id));
    }
  }
}

async function tick() {
  try {
    await tickLifecycle();
    await tickSchedules();
  } catch (err) {
    console.error("scheduler tick failed", err);
  }
}

async function reconcileOnBoot() {
  // If the app process restarted mid-transition, snap servers back to a
  // stable, safe state rather than leaving them stuck.
  const now = new Date();
  await db.update(servers).set({ state: "STOPPED", stateChangedAt: now }).where(or(eq(servers.state, "STARTING"), eq(servers.state, "RESTARTING")));
}

export function startScheduler() {
  if (started) return;
  started = true;
  reconcileOnBoot().catch((err) => console.error("reconcile failed", err));
  setInterval(() => void tick(), TICK_MS);
  console.log("[peakcraft] scheduler/worker started");
}

export { dirSizeBytes };
