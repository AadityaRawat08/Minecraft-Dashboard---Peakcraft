"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mountain } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { postJson, ClientApiError } from "@/lib/client/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/auth/register", form);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Mountain className="h-6 w-6 text-emerald-400" /><span className="text-lg font-semibold text-white">Peakcraft</span>
        </div>
        <h1 className="text-center text-xl font-semibold text-white">Create your account</h1>
        <p className="mt-1 text-center text-sm text-slate-400">Start hosting your Minecraft server in minutes.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Username</label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Password</label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <p className="mt-1 text-xs text-slate-500">At least 8 characters, with uppercase, lowercase and a number.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Confirm password</label>
            <Input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account..." : "Create account"}</Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="text-emerald-400 hover:underline">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
