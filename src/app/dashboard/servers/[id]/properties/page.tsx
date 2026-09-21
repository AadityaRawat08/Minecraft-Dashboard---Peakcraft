"use client";

import { use, useEffect, useState } from "react";
import { apiFetch, patchJson, ClientApiError } from "@/lib/client/api";
import { Button, Card, Input, Select, Skeleton, Switch } from "@/components/ui";
import { toast } from "sonner";

type Schema = { key: string; label: string; type: "boolean" | "number" | "enum" | "text"; options?: string[]; min?: number; max?: number; group: string };
type Data = { properties: Record<string, string>; schema: Schema[] };

export default function PropertiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await apiFetch<Data>(`/api/servers/${id}/properties`);
      setData(res);
      setValues(res.properties);
      const knownKeys = new Set(res.schema.map((s) => s.key));
      setAdvanced(Object.fromEntries(Object.entries(res.properties).filter(([k]) => !knownKeys.has(k))));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      const res = await patchJson<{ restartRequired: boolean }>(`/api/servers/${id}/properties`, { properties: { ...values, ...advanced } });
      toast.success(res.restartRequired ? "Saved. Restart the server to apply changes." : "Saved.");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to save properties.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) return <Skeleton className="h-64 w-full" />;

  const groups = Array.from(new Set(data.schema.map((s) => s.group)));

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Card key={group} className="p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{group}</h3>
          <div className="space-y-4">
            {data.schema.filter((s) => s.group === group).map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <label className="text-sm text-slate-300">{s.label}</label>
                <div className="w-56 shrink-0">
                  {s.type === "boolean" ? (
                    <div className="flex justify-end"><Switch checked={values[s.key] === "true"} onChange={(v) => setValues({ ...values, [s.key]: String(v) })} /></div>
                  ) : s.type === "enum" ? (
                    <Select value={values[s.key] ?? ""} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}>
                      {s.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  ) : s.type === "number" ? (
                    <Input type="number" min={s.min} max={s.max} value={values[s.key] ?? ""} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })} />
                  ) : (
                    <Input value={values[s.key] ?? ""} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Advanced (custom properties)</h3>
        <div className="space-y-3">
          {Object.entries(advanced).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <Input value={key} disabled className="w-1/2 font-mono text-xs" />
              <Input value={value} onChange={(e) => setAdvanced({ ...advanced, [key]: e.target.value })} className="w-1/2 font-mono text-xs" />
            </div>
          ))}
          {Object.keys(advanced).length === 0 && <p className="text-sm text-slate-500">No custom properties detected.</p>}
        </div>
      </Card>

      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save properties"}</Button>
    </div>
  );
}
