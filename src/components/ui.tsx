"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" | "outline"; size?: "sm" | "md" | "lg" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500";
  const variants: Record<string, string> = {
    primary: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
    danger: "bg-red-600 text-white hover:bg-red-500",
    ghost: "bg-transparent text-slate-300 hover:bg-slate-800",
    outline: "border border-slate-700 text-slate-200 hover:bg-slate-800",
  };
  const sizes: Record<string, string> = { sm: "px-2.5 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-base" };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm", className)}>{children}</div>;
}

export function Badge({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "success" | "warning" | "danger" | "info"; className?: string }) {
  const tones: Record<string, string> = {
    default: "bg-slate-800 text-slate-300",
    success: "bg-emerald-500/15 text-emerald-400",
    warning: "bg-amber-500/15 text-amber-400",
    danger: "bg-red-500/15 text-red-400",
    info: "bg-sky-500/15 text-sky-400",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

const STATE_TONE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  RUNNING: "success", STARTING: "info", RESTARTING: "info", STOPPING: "warning",
  STOPPED: "default", ERROR: "danger", CREATING: "info", DELETING: "danger",
};

export function StatusPill({ state }: { state: string }) {
  const dot: Record<string, string> = {
    RUNNING: "bg-emerald-400", STARTING: "bg-sky-400 animate-pulse", RESTARTING: "bg-sky-400 animate-pulse",
    STOPPING: "bg-amber-400 animate-pulse", STOPPED: "bg-slate-500", ERROR: "bg-red-500", CREATING: "bg-sky-400 animate-pulse", DELETING: "bg-red-500 animate-pulse",
  };
  return (
    <Badge tone={STATE_TONE[state] ?? "default"} className="gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[state] ?? "bg-slate-500")} />
      {state.charAt(0) + state.slice(1).toLowerCase()}
    </Badge>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none", props.className)} />;
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 rounded-full transition-colors disabled:opacity-50", checked ? "bg-emerald-500" : "bg-slate-700")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function Progress({ value, max = 100, tone = "default" }: { value: number; max?: number; tone?: "default" | "warning" | "danger" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors: Record<string, string> = { default: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-red-500" };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={cn("h-full rounded-full transition-all", colors[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, requireText, confirmLabel = "Confirm", danger = true, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: ReactNode;
  requireText?: string; confirmLabel?: string; danger?: boolean; loading?: boolean;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => { if (open) setTyped(""); }, [open]);
  const canConfirm = !requireText || typed === requireText;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} disabled={!canConfirm || loading} onClick={onConfirm}>
            {loading ? "Working..." : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3 text-sm text-slate-300">
        {danger && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />}
        <div className="space-y-3">
          <p>{description}</p>
          {requireText && (
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Type <span className="font-mono text-slate-200">{requireText}</span> to confirm
              </label>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 p-12 text-center">
      {icon}
      <h3 className="text-base font-medium text-slate-200">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-400">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-800", className)} />;
}
