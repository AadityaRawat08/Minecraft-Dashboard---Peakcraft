"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "console", label: "Console" },
  { slug: "files", label: "Files & Worlds" },
  { slug: "players", label: "Players" },
  { slug: "plugins", label: "Plugins & Mods" },
  { slug: "backups", label: "Backups" },
  { slug: "properties", label: "Properties" },
  { slug: "schedules", label: "Schedules" },
  { slug: "settings", label: "Settings" },
];

export function ServerDetailChrome({ serverId, name, initialState }: { serverId: string; name: string; initialState: string }) {
  const pathname = usePathname();
  const base = `/dashboard/servers/${serverId}`;
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await apiFetch<{ state: string }>(`/api/servers/${serverId}/actions`);
        if (active) setState(res.state);
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { active = false; clearInterval(t); };
  }, [serverId]);

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-white">{name}</h1>
        <StatusPill state={state} />
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800">
        {TABS.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const active = pathname === href;
          return (
            <Link
              key={tab.slug}
              href={href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-200",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
