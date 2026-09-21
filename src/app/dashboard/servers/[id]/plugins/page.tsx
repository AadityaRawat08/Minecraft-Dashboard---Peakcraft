"use client";

import { use, useEffect, useState } from "react";
import { apiFetch, deleteJson, patchJson, postJson, ClientApiError } from "@/lib/client/api";
import { Badge, Button, Card, EmptyState, Skeleton, Switch } from "@/components/ui";
import { Blocks, Puzzle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CatalogItem = { id: string; name: string; author: string; description: string; category: string; latestVersion: string; homepage: string; compatible: boolean };
type Installed = { id: string; version: string; enabled: boolean; item: CatalogItem };
type Data = { supported: boolean; software: string; catalog: CatalogItem[]; installed: Installed[] };

export default function PluginsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [kind, setKind] = useState<"PLUGIN" | "MOD">("PLUGIN");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(k: "PLUGIN" | "MOD") {
    setLoading(true);
    try {
      const res = await apiFetch<Data>(`/api/servers/${id}/plugins?kind=${k}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(kind); }, [id, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  async function install(catalogItemId: string) {
    try {
      await postJson(`/api/servers/${id}/plugins`, { catalogItemId });
      toast.success("Installed.");
      load(kind);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to install.");
    }
  }

  async function toggle(addonId: string, enabled: boolean) {
    try {
      await patchJson(`/api/servers/${id}/plugins`, { addonId, enabled });
      load(kind);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to update.");
    }
  }

  async function remove(addonId: string) {
    try {
      await deleteJson(`/api/servers/${id}/plugins?id=${addonId}`);
      toast.success("Removed.");
      load(kind);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to remove.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setKind("PLUGIN")} className={cn("rounded-lg px-4 py-2 text-sm font-medium", kind === "PLUGIN" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-300")}>
          <Puzzle className="mr-1.5 inline h-4 w-4" /> Plugins
        </button>
        <button onClick={() => setKind("MOD")} className={cn("rounded-lg px-4 py-2 text-sm font-medium", kind === "MOD" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-300")}>
          <Blocks className="mr-1.5 inline h-4 w-4" /> Mods
        </button>
      </div>

      {loading ? <Skeleton className="h-64 w-full" /> : !data?.supported ? (
        <EmptyState title={`${data?.software} does not support ${kind === "MOD" ? "mods" : "plugins"}`} description="Switch your server software from the Settings tab to use this feature." />
      ) : (
        <>
          {data.installed.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-300">Installed ({data.installed.length})</h3>
              <div className="space-y-2">
                {data.installed.map((addon) => (
                  <Card key={addon.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-slate-100">{addon.item.name} <span className="text-xs text-slate-500">v{addon.version}</span></p>
                      <p className="text-xs text-slate-500">by {addon.item.author}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={addon.enabled} onChange={(v) => toggle(addon.id, v)} />
                      <Button size="sm" variant="ghost" onClick={() => remove(addon.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-300">Catalog</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.catalog.map((item) => {
                const isInstalled = data.installed.some((a) => a.item.id === item.id);
                return (
                  <Card key={item.id} className={cn("p-4", !item.compatible && "opacity-50")}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-100">{item.name}</p>
                        <p className="text-xs text-slate-500">by {item.author} · {item.category}</p>
                      </div>
                      <Badge tone="info">v{item.latestVersion}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                    <Button size="sm" className="mt-3" disabled={isInstalled || !item.compatible} onClick={() => install(item.id)}>
                      {isInstalled ? "Installed" : item.compatible ? "Install" : "Incompatible"}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
