"use client";

import { use, useEffect, useState } from "react";
import { apiFetch, deleteJson, patchJson, postJson, ClientApiError } from "@/lib/client/api";
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton, Switch } from "@/components/ui";
import { CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Task = { id: string; action: string; recurrence: { type: string; hours?: number; time?: string; day?: number }; commandText: string | null; retention: number | null; enabled: boolean; nextRunAt: string; lastRunAt: string | null };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SchedulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("RESTART");
  const [recurrenceType, setRecurrenceType] = useState("interval");
  const [hours, setHours] = useState(6);
  const [time, setTime] = useState("04:00");
  const [day, setDay] = useState(0);
  const [commandText, setCommandText] = useState("");
  const [retention, setRetention] = useState(7);

  async function load() {
    try {
      const res = await apiFetch<Task[]>(`/api/servers/${id}/schedules`);
      setTasks(res);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    const recurrence = recurrenceType === "interval" ? { type: "interval", hours } : recurrenceType === "daily" ? { type: "daily", time } : { type: "weekly", time, day };
    try {
      await postJson(`/api/servers/${id}/schedules`, { action, recurrence, commandText: action === "COMMAND" ? commandText : undefined, retention: action === "BACKUP" ? retention : undefined });
      toast.success("Schedule created.");
      load();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to create schedule.");
    }
  }

  async function toggle(taskId: string, enabled: boolean) {
    await patchJson(`/api/servers/${id}/schedules`, { taskId, enabled }).then(load).catch(() => toast.error("Failed to update schedule."));
  }

  async function remove(taskId: string) {
    await deleteJson(`/api/servers/${id}/schedules?id=${taskId}`).then(load).catch(() => toast.error("Failed to delete schedule."));
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-300">New schedule</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Action</label>
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="START">Start server</option>
              <option value="STOP">Stop server</option>
              <option value="RESTART">Restart server</option>
              <option value="BACKUP">Create backup</option>
              <option value="COMMAND">Run command</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Recurrence</label>
            <Select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
              <option value="interval">Every N hours</option>
              <option value="daily">Daily at time</option>
              <option value="weekly">Weekly on a day</option>
            </Select>
          </div>
          {recurrenceType === "interval" && (
            <div><label className="mb-1 block text-xs text-slate-400">Every (hours)</label><Input type="number" min={1} max={168} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></div>
          )}
          {recurrenceType !== "interval" && (
            <div><label className="mb-1 block text-xs text-slate-400">Time</label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          )}
          {recurrenceType === "weekly" && (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Day</label>
              <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
            </div>
          )}
          {action === "COMMAND" && (
            <div className="sm:col-span-2"><label className="mb-1 block text-xs text-slate-400">Command</label><Input value={commandText} onChange={(e) => setCommandText(e.target.value)} placeholder="say Server restarting soon" /></div>
          )}
          {action === "BACKUP" && (
            <div><label className="mb-1 block text-xs text-slate-400">Keep last N backups</label><Input type="number" min={1} max={50} value={retention} onChange={(e) => setRetention(Number(e.target.value))} /></div>
          )}
        </div>
        <Button onClick={create}><CalendarClock className="h-4 w-4" /> Add schedule</Button>
      </Card>

      {tasks.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-8 w-8 text-slate-600" />} title="No schedules configured" />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge>{t.action}</Badge>
                  <p className="text-sm text-slate-300">
                    {t.recurrence.type === "interval" && `Every ${t.recurrence.hours}h`}
                    {t.recurrence.type === "daily" && `Daily at ${t.recurrence.time}`}
                    {t.recurrence.type === "weekly" && `${DAYS[t.recurrence.day ?? 0]} at ${t.recurrence.time}`}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500">Next run: {new Date(t.nextRunAt).toLocaleString()}{t.lastRunAt && ` · Last run: ${new Date(t.lastRunAt).toLocaleString()}`}</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={t.enabled} onChange={(v) => toggle(t.id, v)} />
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
