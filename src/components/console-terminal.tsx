"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, postJson, ClientApiError } from "@/lib/client/api";
import { Button, Input } from "@/components/ui";
import { Download, Pause, Play, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Line = { id: number; stream: "OUT" | "IN" | "SYSTEM"; line: string; createdAt: string };

export function ConsoleTerminal({ serverId, running }: { serverId: string; running: boolean }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [cursor, setCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const [command, setCommand] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (!active) return;
      if (!paused) {
        try {
          const res = await apiFetch<{ lines: Line[]; cursor: number }>(`/api/servers/${serverId}/console?afterId=${cursor}`);
          if (active && res.lines.length) {
            setLines((prev) => [...prev, ...res.lines].slice(-1000));
            setCursor(res.cursor);
          }
          setConnected(true);
        } catch {
          setConnected(false);
        }
      }
      if (active) timer = setTimeout(poll, 2000);
    }
    poll();
    return () => { active = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, paused]);

  useEffect(() => {
    if (!paused && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, paused]);

  async function sendCommand() {
    if (!command.trim()) return;
    setSending(true);
    try {
      await postJson(`/api/servers/${serverId}/console`, { command });
      setCommand("");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to send command.");
    } finally {
      setSending(false);
    }
  }

  const filtered = search ? lines.filter((l) => l.line.toLowerCase().includes(search.toLowerCase())) : lines;

  const streamColor: Record<Line["stream"], string> = {
    OUT: "text-slate-300", IN: "text-emerald-400", SYSTEM: "text-amber-400",
  };

  return (
    <div className="flex h-[32rem] flex-col overflow-hidden rounded-xl border border-slate-800 bg-black">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/60 p-2">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-500"}`} title={connected ? "Live" : "Disconnected"} />
        <span className="text-xs text-slate-400">{connected ? "Live" : "Reconnecting…"}</span>
        <div className="relative ml-2 flex-1 min-w-[140px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs…" className="h-8 pl-7 text-xs" />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setPaused((p) => !p)}>
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />} {paused ? "Resume" : "Pause"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setLines([])}>
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </Button>
        <Button size="sm" variant="ghost" onClick={() => window.open(`/api/servers/${serverId}/console?download=1`, "_blank")}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed">
        {filtered.length === 0 && <p className="text-slate-600">No console output yet.</p>}
        {filtered.map((l) => (
          <div key={l.id} className={streamColor[l.stream]}>
            <span className="mr-2 text-slate-600">[{new Date(l.createdAt).toLocaleTimeString()}]</span>
            {l.line}
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-slate-800 bg-slate-900/60 p-2"
        onSubmit={(e) => { e.preventDefault(); sendCommand(); }}
      >
        <span className="pl-2 font-mono text-emerald-400">/</span>
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={running ? "say Hello world" : "Server must be running to send commands"}
          disabled={!running || sending}
          className="h-9 border-none bg-transparent font-mono focus:ring-0"
        />
        <Button type="submit" size="sm" disabled={!running || sending}>Send</Button>
      </form>
    </div>
  );
}
