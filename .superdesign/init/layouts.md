# Shared layout and chrome

## web/src/app/layout.tsx

Root HTML shell, dark class, metadata, and global style import.

```tsx
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Synthetix Engine — Content Workspace",
  description: "Turn multimodal source material into strategic content."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}

```
## web/src/components/dashboard/Header.tsx

Dashboard brand header, health indicators, recent jobs dialog, and new-job control. Props: history, onReset, onSelectJob.

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, History, Plus, Waypoints, X } from "lucide-react";
import Link from "next/link";
import type { RecentJob, SystemStatus } from "@/types/dashboard";

interface Props { history: RecentJob[]; onReset: () => void; onSelectJob: (id: string) => void }
export default function Header({ history, onReset, onSelectJob }: Props): React.JSX.Element {
  const [health, setHealth] = useState<SystemStatus | null>(null);
  const [healthError, setHealthError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const check = async () => {
      try {
        const response = await fetch("/api/system/status", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Status unavailable");
        const data = await response.json() as SystemStatus;
        if (!cancelled) { setHealth(data); setHealthError(false); }
      } catch { if (!cancelled) setHealthError(true); }
      if (!cancelled) timer = setTimeout(check, 30_000);
    };
    void check();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, []);
  return <>
    <header className="border-b border-slate-800/80 bg-[#0b0f1a]/90">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 xl:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="Synthetix Engine home"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-300"><Waypoints size={23} strokeWidth={1.6} /></span><span className="text-base font-semibold tracking-tight text-white">synthetix<span className="ml-2 font-normal text-slate-500">/ engine</span></span></Link>
        <div className="hidden items-center gap-5 text-[11px] text-slate-400 md:flex" aria-label="Service status">
          <span className="flex items-center gap-2"><span className={`status-dot ${!healthError && health?.orchestrator === "online" ? "status-dot-online" : ""}`} />{healthError ? "Status unavailable" : health ? `Orchestrator ${health.orchestrator}` : "Checking orchestrator…"}</span>
          <span className="flex items-center gap-2"><span className={`status-dot ${!healthError && health?.worker === "online" ? "status-dot-online" : ""}`} />{healthError ? "Status unavailable" : health ? `Worker ${health.worker}` : "Checking worker…"}</span>
        </div>
        <div className="flex items-center gap-2"><button type="button" className="secondary-button" aria-label={`Recent jobs${history.length ? ` (${history.length})` : ""}`} onClick={() => dialog.current?.showModal()}><History size={15} aria-hidden="true" /><span className="hidden sm:inline">Recent jobs</span>{history.length > 0 && <span className="text-slate-500">{history.length}</span>}</button><button type="button" className="secondary-button" onClick={onReset}><Plus size={15} aria-hidden="true" /><span>New</span></button></div>
      </div>
      <div className="mx-auto flex max-w-[1440px] gap-5 border-t border-slate-800/70 px-5 py-2.5 text-[10px] text-slate-400 md:hidden" aria-label="Service status">
        <span className="flex items-center gap-2"><span className={`status-dot ${!healthError && health?.orchestrator === "online" ? "status-dot-online" : ""}`} />Orchestrator {healthError ? "status unavailable" : health?.orchestrator ?? "checking"}</span>
        <span className="flex items-center gap-2"><span className={`status-dot ${!healthError && health?.worker === "online" ? "status-dot-online" : ""}`} />Worker {healthError ? "status unavailable" : health?.worker ?? "checking"}</span>
      </div>
    </header>
    <dialog ref={dialog} className="history-dialog" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="flex items-center justify-between border-b border-slate-800 p-6"><div><h2 className="text-lg font-semibold text-white">Recent transformations</h2><p className="mt-1 text-xs text-slate-400">Saved in this browser · last observed status</p></div><button type="button" className="icon-button" aria-label="Close job history" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      <div className="max-h-[65vh] overflow-y-auto p-3">{history.length === 0 ? <p className="p-8 text-center text-sm leading-6 text-slate-400">Your submitted transformations will appear here.<br />Start with a source to create your first one.</p> : history.map((item) => <button type="button" key={item.id} className="flex w-full items-center gap-4 rounded-lg p-4 text-left hover:bg-slate-800/60" onClick={() => { onSelectJob(item.id); dialog.current?.close(); }}><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-200">{item.label}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></div><span className={`text-[10px] font-semibold uppercase tracking-wide ${item.status === "FAILED" ? "text-rose-300" : item.status === "COMPLETED" ? "text-emerald-300" : "text-indigo-300"}`}>{item.status}</span><ArrowUpRight size={16} className="text-slate-500" aria-hidden="true" /></button>)}</div>
    </dialog>
  </>;
}

```
