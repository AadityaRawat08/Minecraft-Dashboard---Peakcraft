"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, postJson, ClientApiError } from "@/lib/client/api";
import { Button, Card, Progress } from "@/components/ui";
import { ResourceChart } from "@/components/resource-chart";
import { formatUptime } from "@/lib/utils";
import { Play, Square, RotateCw, Power } from "lucide-react";
import { toast } from "sonner";

type Status = {
  state: string; uptimeMs: number;
  resources: { cpuPercent: number; ramMb: number; ramMaxMb: number; diskUsedMb: number; diskMaxMb: number };
  players: { online: number; max: number };
  address: { host: string; port: number };
};

type MetricPoint = { time: string; cpu: number; ram: number; players: number };

export function ServerOverviewClient({ serverId }: { serverId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [series, setSeries] = useState<MetricPoint[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const [s, m] = await Promise.all([
          apiFetch<Status>(`/api/servers/${serverId}/actions`),
          apiFetch<{ series: MetricPoint[] }>(`/api/servers/${serverId}/metrics?minutes=20`),
        ]);
        if (active) { setStatus(s); setSeries(m.series); }
      } catch { /* ignore */ }
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => { active = false; clearInterval(t); };
  }, [serverId]);

  async function act(action: "START" | "STOP" | "RESTART" | "KILL") {
    setBusy(true);
    try {
      await postJson(`/api/servers/${serverId}/actions`, { action });
      toast.success(`Server ${action.toLowerCase()} requested.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const state = status?.state ?? "STOPPED";

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="text-sm text-slate-400">
          <p>Address: <span className="font-mono text-slate-200">{status?.address.host ?? "—"}:{status?.address.port ?? "—"}</span></p>
          <p>Uptime: {formatUptime(status?.uptimeMs ?? 0)}</p>
        </div>
        <div className="flex gap-2">
          {state === "STOPPED" || state === "ERROR" ? (
            <Button onClick={() => act("START")} disabled={busy}><Play className="h-4 w-4" /> Start</Button>
          ) : state === "RUNNING" ? (
            <>
              <Button variant="secondary" onClick={() => act("STOP")} disabled={busy}><Square className="h-4 w-4" /> Stop</Button>
              <Button variant="outline" onClick={() => act("RESTART")} disabled={busy}><RotateCw className="h-4 w-4" /> Restart</Button>
            </>
          ) : (
            <Button variant="secondary" disabled>{state.charAt(0) + state.slice(1).toLowerCase()}…</Button>
          )}
          {!["STOPPED", "ERROR"].includes(state) && (
            <Button variant="danger" onClick={() => act("KILL")} disabled={busy}><Power className="h-4 w-4" /> Kill</Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">CPU usage</p>
          <p className="mt-1 text-xl font-semibold text-white">{status?.resources.cpuPercent.toFixed(1) ?? 0}%</p>
          <Progress value={status?.resources.cpuPercent ?? 0} tone={((status?.resources.cpuPercent ?? 0) > 80) ? "danger" : "default"} />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">RAM usage</p>
          <p className="mt-1 text-xl font-semibold text-white">{status?.resources.ramMb ?? 0} / {status?.resources.ramMaxMb ?? 0} MB</p>
          <Progress value={status?.resources.ramMb ?? 0} max={status?.resources.ramMaxMb ?? 1} />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Disk usage</p>
          <p className="mt-1 text-xl font-semibold text-white">{status?.resources.diskUsedMb ?? 0} / {status?.resources.diskMaxMb ?? 0} MB</p>
          <Progress value={status?.resources.diskUsedMb ?? 0} max={status?.resources.diskMaxMb ?? 1} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><p className="mb-2 text-sm font-medium text-slate-300">CPU over time</p><ResourceChart data={series} dataKey="cpu" color="#34d399" unit="%" /></Card>
        <Card className="p-4"><p className="mb-2 text-sm font-medium text-slate-300">Players online</p><ResourceChart data={series} dataKey="players" color="#38bdf8" unit="" /></Card>
      </div>
    </div>
  );
}
