"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select } from "@/components/ui";
import { postJson, ClientApiError } from "@/lib/client/api";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Software = { id: string; label: string; description: string; supportsPlugins: boolean; supportsMods: boolean };
type Region = { id: string; label: string };

const STEPS = ["Name", "Version", "Software", "Resources", "Region", "Confirm"];

export function CreateServerWizard({ versions, software, regions, maxServers, existingCount }: {
  versions: string[]; software: Software[]; regions: Region[]; maxServers: number; existingCount: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", mcVersion: versions[0], software: software[0]?.id ?? "", ramMb: 4096, cpuCores: 2, storageMb: 10240, region: regions[0]?.id ?? "",
  });

  const atLimit = existingCount >= maxServers;

  function next() { setStep((s) => Math.min(STEPS.length - 1, s + 1)); }
  function back() { setStep((s) => Math.max(0, s - 1)); }

  const canProceed = [
    form.name.trim().length >= 3,
    !!form.mcVersion,
    !!form.software,
    form.ramMb >= 1024 && form.cpuCores >= 1 && form.storageMb >= 2048,
    !!form.region,
    true,
  ][step];

  async function submit() {
    setCreating(true);
    try {
      const server = await postJson<{ id: string }>("/api/servers", form);
      toast.success("Server created! Provisioning now…");
      router.push(`/dashboard/servers/${server.id}`);
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to create server.");
      setCreating(false);
    }
  }

  if (atLimit) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-300">You have reached your limit of {maxServers} servers.</p>
        <p className="mt-2 text-sm text-slate-500">Delete an existing server to create a new one.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i < step ? "bg-emerald-500 text-slate-950" : i === step ? "border border-emerald-500 text-emerald-400" : "border border-slate-700 text-slate-500"}`}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`whitespace-nowrap text-xs ${i === step ? "text-slate-100" : "text-slate-500"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-slate-800" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Server name</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Awesome Server" autoFocus />
          <p className="text-xs text-slate-500">3-40 characters. This is shown on your dashboard and server card.</p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Minecraft version</label>
          <Select value={form.mcVersion} onChange={(e) => setForm({ ...form, mcVersion: e.target.value })}>
            {versions.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {software.map((s) => (
            <button
              key={s.id}
              onClick={() => setForm({ ...form, software: s.id })}
              className={`rounded-lg border p-4 text-left transition-colors ${form.software === s.id ? "border-emerald-500 bg-emerald-500/5" : "border-slate-800 hover:border-slate-700"}`}
            >
              <p className="font-medium text-slate-100">{s.label}</p>
              <p className="mt-1 text-xs text-slate-500">{s.description}</p>
              <p className="mt-2 text-xs text-emerald-400">{s.supportsPlugins ? "Supports plugins" : s.supportsMods ? "Supports mods" : "No addons"}</p>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <label className="flex justify-between text-sm font-medium text-slate-300"><span>RAM allocation</span><span>{form.ramMb} MB</span></label>
            <input type="range" min={1024} max={16384} step={512} value={form.ramMb} onChange={(e) => setForm({ ...form, ramMb: Number(e.target.value) })} className="w-full accent-emerald-500" />
          </div>
          <div>
            <label className="flex justify-between text-sm font-medium text-slate-300"><span>CPU cores</span><span>{form.cpuCores}</span></label>
            <input type="range" min={1} max={8} step={1} value={form.cpuCores} onChange={(e) => setForm({ ...form, cpuCores: Number(e.target.value) })} className="w-full accent-emerald-500" />
          </div>
          <div>
            <label className="flex justify-between text-sm font-medium text-slate-300"><span>Storage</span><span>{(form.storageMb / 1024).toFixed(1)} GB</span></label>
            <input type="range" min={2048} max={51200} step={1024} value={form.storageMb} onChange={(e) => setForm({ ...form, storageMb: Number(e.target.value) })} className="w-full accent-emerald-500" />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {regions.map((r) => (
            <button
              key={r.id}
              onClick={() => setForm({ ...form, region: r.id })}
              className={`rounded-lg border p-4 text-left transition-colors ${form.region === r.id ? "border-emerald-500 bg-emerald-500/5" : "border-slate-800 hover:border-slate-700"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2 text-sm">
          {[
            ["Name", form.name], ["Version", form.mcVersion], ["Software", software.find((s) => s.id === form.software)?.label],
            ["RAM", `${form.ramMb} MB`], ["CPU", `${form.cpuCores} cores`], ["Storage", `${(form.storageMb / 1024).toFixed(1)} GB`],
            ["Region", regions.find((r) => r.id === form.region)?.label],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-slate-800 py-2">
              <span className="text-slate-500">{label}</span><span className="font-medium text-slate-200">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0}><ChevronLeft className="h-4 w-4" /> Back</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canProceed}>Next <ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <Button onClick={submit} disabled={creating}>{creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Server"}</Button>
        )}
      </div>
    </Card>
  );
}
