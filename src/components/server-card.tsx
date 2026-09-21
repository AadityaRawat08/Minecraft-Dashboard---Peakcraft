"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, StatusPill, Button, Progress } from "@/components/ui";
import { apiFetch, postJson, ClientApiError } from "@/lib/client/api";
import { formatBytes } from "@/lib/utils";
import { Cpu, MemoryStick, HardDrive, Users, Play, Square, RotateCw, Settings } from "lucide-react";
import { toast } from "sonner";

type ServerSummary = {
  id: string; name: string; state: string; mcVersion: string; software: string;
  ramMb: number; cpuCores: number; storageMb: number; port: number;
};

type Status = {
  resources: { cpuPercent: number; ramMb: number; ramMaxMb: number; diskUsedMb: number; diskMaxMb: number };
  players: { online: number; max: number };
};

export function ServerCard({ server }: { server: ServerSummary }) {
  const router = useRouter();
  const [state, setState] = useState(server.state);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const res = await apiFetch<{ state: string } & Status>(`/api/servers/${server.id}/actions`);
      setState(res.state);
      setStatus(res);
    } catch {
      // ignore transient errors on dashboard cards
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(action: "START" | "STOP" | "RESTART") {
    setBusy(true);
    try {
      await postJson(`/api/servers/${server.id}/actions`, { action });
      toast.success(`${action.charAt(0)}${action.slice(1).toLowerCase()} requested.`);
      router.refresh();
      refresh();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/dashboard/servers/${server.id}`} className="font-semibold text-slate-100 hover:text-emerald-400">{server.name}</Link>
          <p className="text-xs text-slate-500">{server.software} · {server.mcVersion} · Port {server.port}</p>
        </div>
        <StatusPill state={state} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs text-slate-400">
        <div className="space-y-1">
          <div className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> CPU</div>
          <Progress value={status?.resources.cpuPercent ?? 0} tone={((status?.resources.cpuPercent ?? 0) > 80) ? "danger" : "default"} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1"><MemoryStick className="h-3.5 w-3.5" /> RAM</div>
          <Progress value={status?.resources.ramMb ?? 0} max={status?.resources.ramMaxMb ?? server.ramMb} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> Disk</div>
          <Progress value={status?.resources.diskUsedMb ?? 0} max={status?.resources.diskMaxMb ?? server.storageMb} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {status?.players.online ?? 0}/{status?.players.max ?? "-"} players</span>
        <span>{formatBytes((status?.resources.diskUsedMb ?? 0) * 1024 * 1024)} used</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {state === "STOPPED" || state === "ERROR" ? (
          <Button size="sm" onClick={() => act("START")} disabled={busy}><Play className="h-3.5 w-3.5" /> Start</Button>
        ) : state === "RUNNING" ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => act("STOP")} disabled={busy}><Square className="h-3.5 w-3.5" /> Stop</Button>
            <Button size="sm" variant="outline" onClick={() => act("RESTART")} disabled={busy}><RotateCw className="h-3.5 w-3.5" /> Restart</Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" disabled>{state.charAt(0) + state.slice(1).toLowerCase()}…</Button>
        )}
        <Link href={`/dashboard/servers/${server.id}`}>
          <Button size="sm" variant="ghost"><Settings className="h-3.5 w-3.5" /> Manage</Button>
        </Link>
      </div>
    </Card>
  );
}
