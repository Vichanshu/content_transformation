"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Check, Clock3, Cpu, LoaderCircle, RefreshCw } from "lucide-react";
import type { JobStatus, PolledJobResult } from "@/types/dashboard";

const STAGES: Array<{ status: JobStatus; label: string; detail: string }> = [
  { status: "PENDING", label: "Submitted", detail: "Queued for processing" },
  { status: "EXTRACTING", label: "Extracting", detail: "Reading your source" },
  { status: "ROUTING", label: "Routing", detail: "Scoring complexity" },
  { status: "GENERATING", label: "Generating", detail: "Creating your content" },
  { status: "FORMATTING", label: "Formatting", detail: "Preparing deliverables" },
  { status: "COMPLETED", label: "Completed", detail: "Ready to use" }
];
interface Props { jobId: string; job: PolledJobResult | null; connectionError: string | null; onRetry: () => void }
export default function JobStatusTracker({ jobId, job, connectionError, onRetry }: Props): React.JSX.Element {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const terminal = job?.status === "COMPLETED" || job?.status === "FAILED";
  const start = job ? Date.parse(job.createdAt) : now;
  const end = terminal && job ? Date.parse(job.updatedAt) : now;
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const elapsed = Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s` : "—";
  const current = STAGES.findIndex((stage) => stage.status === (job?.status ?? "PENDING"));
  return <section className="panel scroll-mt-6" id="pipeline" aria-labelledby="pipeline-heading">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">LIVE PIPELINE</p><h2 id="pipeline-heading" className="mt-2 text-xl font-semibold text-white" aria-live="polite">{job?.status === "FAILED" ? "This transformation needs attention" : job?.status === "COMPLETED" ? "Your content is ready" : "Transformation in progress"}</h2><p className="mt-2 break-all font-mono text-[10px] text-slate-500">JOB / {jobId}</p></div><div className="flex flex-wrap gap-2"><span className="metric-badge"><Clock3 size={13} aria-hidden="true" />{elapsed}</span>{job?.complexityScore != null && <span className="metric-badge">Complexity {job.complexityScore}/10</span>}{job?.selectedTier && <span className="metric-badge text-indigo-300"><Cpu size={13} aria-hidden="true" />{job.selectedTier === "PREMIUM" ? "MoA ensemble" : "Single-agent"}</span>}</div></div>
    <ol className="mt-8 grid grid-cols-2 gap-y-6 sm:grid-cols-3 xl:grid-cols-6">{STAGES.map((stage, index) => {
      const done = current > index || job?.status === "COMPLETED";
      const active = index === current && !terminal;
      return <li key={stage.status} aria-current={active ? "step" : undefined} className="relative pr-3"><div className="flex items-center"><span className={`stage-circle ${done ? "stage-done" : active ? "stage-active" : ""}`}>{done ? <Check size={16} /> : active ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> : <span>{String(index + 1).padStart(2, "0")}</span>}</span>{index < STAGES.length - 1 && <span className={`mx-3 h-px flex-1 ${done ? "bg-indigo-500/40" : "bg-slate-800"}`} />}</div><p className={`mt-3 text-xs font-medium ${active || done ? "text-slate-100" : "text-slate-500"}`}>{stage.label}</p><p className="mt-1 text-[10px] text-slate-500">{stage.detail}</p></li>;
    })}</ol>
    {connectionError && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200"><span>{connectionError}</span><button type="button" className="secondary-button shrink-0" onClick={onRetry}><RefreshCw size={14} />Retry</button></div>}
    {job?.status === "FAILED" && <div role="alert" className="mt-6 flex gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4"><AlertCircle size={19} className="shrink-0 text-rose-400" aria-hidden="true" /><div><p className="text-sm font-medium text-rose-200">We couldn’t finish this transformation.</p><p className="mt-2 break-words text-xs leading-5 text-slate-400">{job.errorMessage || "Check your source and service configuration, then submit a new job."}</p><p className="mt-2 text-xs text-slate-500">Your form is still available. Review it and try again.</p></div></div>}
  </section>;
}
