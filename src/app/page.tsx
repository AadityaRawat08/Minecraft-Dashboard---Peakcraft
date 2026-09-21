import Link from "next/link";
import { Mountain, Terminal, FolderCog, ShieldCheck, Gauge, Blocks, ArrowRight, Check } from "lucide-react";

const FEATURES = [
  { icon: Terminal, title: "Real-time console", desc: "Stream server output live and send Minecraft commands instantly, with searchable history and one-click downloads." },
  { icon: FolderCog, title: "Full file manager", desc: "Browse, edit, upload and compress every file in your server's sandbox — including server.properties, whitelist and ops." },
  { icon: ShieldCheck, title: "Backups & restore", desc: "One-click backups with configurable retention, safe restore workflows, and typed confirmation for destructive actions." },
  { icon: Blocks, title: "Plugins & mods", desc: "Install and manage Paper/Spigot plugins or Fabric/Forge mods from a curated, version-aware catalog." },
  { icon: Gauge, title: "Live resource monitoring", desc: "CPU, RAM, disk and player-count charts that update without ever reloading the page." },
  { icon: ShieldCheck, title: "Granular permissions", desc: "Role-based access control with per-server ownership checks on every single API request." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Mountain className="h-6 w-6 text-emerald-400" />
          <span className="text-lg font-semibold">Peakcraft</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:text-white">Log in</Link>
          <Link href="/register" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="mb-4 inline-block rounded-full border border-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-emerald-400">Minecraft server hosting, reimagined</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-6xl">Your Minecraft Server. <span className="text-emerald-400">Your Control.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Peakcraft Panel is a full-stack control plane for Minecraft servers — provisioning, a live console,
          a real file manager, plugins, backups, and resource monitoring, all from one clean dashboard.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/register" className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-medium text-slate-950 hover:bg-emerald-400">
            Create Your Server <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="rounded-lg border border-slate-700 px-6 py-3 font-medium text-slate-200 hover:bg-slate-900">
            I already have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <f.icon className="h-8 w-8 text-emerald-400" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-900/30 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold">From zero to a running world in minutes</h2>
          <div className="mt-10 grid gap-6 text-left sm:grid-cols-2">
            {["Register an account", "Create a server & pick your version/software", "Start it and open the live console", "Manage files, players, plugins & backups"].map((step, i) => (
              <div key={step} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400">{i + 1}</span>
                <span className="flex items-center gap-2 text-sm text-slate-300"><Check className="h-4 w-4 text-emerald-400" /> {step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-slate-500 sm:flex-row">
        <span>© {new Date().getFullYear()} Peakcraft Panel. Independent hosting panel, not affiliated with Mojang.</span>
        <div className="flex gap-4">
          <Link href="/legal#terms" className="hover:text-slate-300">Terms</Link>
          <Link href="/legal#privacy" className="hover:text-slate-300">Privacy</Link>
        </div>
      </footer>
    </main>
  );
}
