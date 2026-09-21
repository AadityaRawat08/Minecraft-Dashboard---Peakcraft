"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, deleteJson, patchJson, ClientApiError } from "@/lib/client/api";
import { Button, Card, ConfirmDialog, Input, Skeleton } from "@/components/ui";
import { toast } from "sonner";
import { Laptop, Trash2 } from "lucide-react";

type Me = { id: string; username: string; email: string; role: string; createdAt: string };
type Session = { id: string; userAgent: string; ip: string; createdAt: string; lastUsedAt: string; current: boolean };

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [username, setUsername] = useState("");
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [meRes, sessionsRes] = await Promise.all([
      apiFetch<Me>("/api/auth/me"),
      apiFetch<Session[]>("/api/auth/sessions"),
    ]);
    setMe(meRes);
    setUsername(meRes.username);
    setSessions(sessionsRes);
    setLoading(false);
  }

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  async function saveProfile() {
    try {
      await patchJson("/api/auth/me", { username });
      toast.success("Profile updated.");
      load();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to update profile.");
    }
  }

  async function changePassword() {
    try {
      await patchJson("/api/auth/password", passwords);
      toast.success("Password changed.");
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to change password.");
    }
  }

  async function revokeSession(id: string) {
    try {
      await deleteJson(`/api/auth/sessions?id=${id}`);
      load();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to revoke session.");
    }
  }

  async function revokeOthers() {
    try {
      await deleteJson("/api/auth/sessions?scope=others");
      toast.success("Other sessions logged out.");
      load();
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to revoke sessions.");
    }
  }

  async function deleteAccount() {
    try {
      await deleteJson("/api/auth/me", { confirmation: "DELETE MY ACCOUNT" });
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : "Failed to delete account.");
    }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (!me) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">Account Settings</h1>

      <Card className="p-6">
        <h2 className="text-lg font-medium text-white">Profile</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Email</label>
            <Input value={me.email} disabled />
          </div>
          <p className="text-xs text-slate-500">Account created {new Date(me.createdAt).toLocaleDateString()}</p>
          <Button onClick={saveProfile}>Save changes</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-medium text-white">Change password</h2>
        <div className="mt-4 space-y-3">
          <Input type="password" placeholder="Current password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />
          <Input type="password" placeholder="New password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
          <Input type="password" placeholder="Confirm new password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} />
          <Button onClick={changePassword}>Update password</Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Active sessions</h2>
          <Button size="sm" variant="outline" onClick={revokeOthers}>Log out other sessions</Button>
        </div>
        <div className="mt-4 space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-800 p-3 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <Laptop className="h-4 w-4 text-slate-500" />
                <div>
                  <p>{s.userAgent?.slice(0, 60) || "Unknown device"} {s.current && <span className="text-emerald-400">(this device)</span>}</p>
                  <p className="text-xs text-slate-500">IP {s.ip} · last used {new Date(s.lastUsedAt).toLocaleString()}</p>
                </div>
              </div>
              {!s.current && <Button size="sm" variant="ghost" onClick={() => revokeSession(s.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-red-900/50 p-6">
        <h2 className="text-lg font-medium text-red-400">Danger zone</h2>
        <p className="mt-2 text-sm text-slate-400">Deleting your account requires all servers to be deleted first, and cannot be undone.</p>
        <Button variant="danger" className="mt-4" onClick={() => setDeleteConfirm(true)}>Delete account</Button>
      </Card>

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={deleteAccount}
        title="Delete your account"
        description="This will permanently delete your account. This action cannot be undone."
        requireText="DELETE MY ACCOUNT"
        confirmLabel="Delete account"
      />
    </div>
  );
}
