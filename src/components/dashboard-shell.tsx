"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Server, PlusCircle, UserCircle, ShieldCheck, LogOut, Menu, Bell, BookOpen, LifeBuoy, Mountain,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { postJson, patchJson, usePolling } from "@/lib/client/api";
import { Badge } from "@/components/ui";
import { toast } from "sonner";

type NavItem = { href: string; label: string; icon: React.ElementType };

const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/servers", label: "My Servers", icon: Server },
  { href: "/dashboard/servers/new", label: "Create Server", icon: PlusCircle },
  { href: "/dashboard/account", label: "Account", icon: UserCircle },
];

type Notification = { id: string; title: string; message: string; read: boolean; createdAt: string };

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data } = usePolling<Notification[]>(() => import("@/lib/client/api").then((m) => m.apiFetch<Notification[]>("/api/notifications")), 15000);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Notifications" className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-emerald-400" />}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 p-3">
            <span className="text-sm font-medium text-slate-200">Notifications</span>
            {unread > 0 && (
              <button
                className="text-xs text-emerald-400 hover:underline"
                onClick={() => patchJson("/api/notifications", { all: true }).catch(() => {})}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-sm text-slate-500">You&apos;re all caught up.</p>}
            {items.map((n) => (
              <div key={n.id} className={cn("border-b border-slate-800/60 p-3 text-sm", !n.read && "bg-slate-800/40")}>
                <p className="font-medium text-slate-200">{n.title}</p>
                <p className="mt-0.5 text-slate-400">{n.message}</p>
                <p className="mt-1 text-xs text-slate-500">{timeAgo(new Date(n.createdAt))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardShell({
  children, user, variant = "user",
}: {
  children: React.ReactNode;
  user: { username: string; role: string };
  variant?: "user" | "admin";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const nav = variant === "admin"
    ? [
        { href: "/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/users", label: "Users", icon: UserCircle },
        { href: "/admin/servers", label: "Servers", icon: Server },
        { href: "/admin/nodes", label: "Nodes", icon: ShieldCheck },
        { href: "/admin/audit-logs", label: "Audit Logs", icon: BookOpen },
      ]
    : USER_NAV;

  async function handleLogout() {
    await postJson("/api/auth/logout").catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const isAdminRole = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <Mountain className="h-6 w-6 text-emerald-400" />
        <span className="text-lg font-semibold text-white">Peakcraft</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-emerald-500/10 text-emerald-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
              )}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </Link>
          );
        })}
        {variant === "user" && isAdminRole && (
          <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-amber-400 hover:bg-slate-800">
            <ShieldCheck className="h-4 w-4" /> Admin Panel
          </Link>
        )}
        {variant === "admin" && (
          <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            <LayoutDashboard className="h-4 w-4" /> Back to dashboard
          </Link>
        )}
      </nav>
      <div className="space-y-1 border-t border-slate-800 px-3 py-4">
        <a href="/docs" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <BookOpen className="h-4 w-4" /> Documentation
        </a>
        <a href="/support" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <LifeBuoy className="h-4 w-4" /> Support
        </a>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-red-400">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800 bg-slate-900/40 lg:block">{SidebarContent}</aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-slate-900">{SidebarContent}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur lg:px-8">
          <button className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm text-slate-400 lg:block">
            {variant === "admin" ? "Administration" : "Control Panel"}
          </div>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-400">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-sm sm:block">
                <p className="font-medium text-slate-100">{user.username}</p>
                <Badge tone="info">{user.role}</Badge>
              </div>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}


