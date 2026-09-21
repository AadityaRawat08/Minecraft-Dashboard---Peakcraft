"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mountain } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { postJson, ClientApiError } from "@/lib/client/api";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/auth/login", { identifier, password, remember });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Mountain className="h-6 w-6 text-emerald-400" /><span className="text-lg font-semibold text-white">Peakcraft</span>
        </div>
        <h1 className="text-center text-xl font-semibold text-white">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-slate-400">Log in to manage your Minecraft servers.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Email or username</label>
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-slate-700 bg-slate-950" />
            Remember me
          </label>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Log in"}</Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          No account? <Link href="/register" className="text-emerald-400 hover:underline">Create one</Link>
        </p>
        <p className="mt-3 rounded-lg bg-slate-800/50 p-3 text-center text-xs text-slate-500">
          Demo: demo@example.com / DemoPass123 &middot; Admin: admin@example.com / AdminPass123
        </p>
      </Card>
    </main>
  );
}
