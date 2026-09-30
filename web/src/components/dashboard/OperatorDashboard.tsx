"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Layers3, LockKeyhole } from "lucide-react";
import { DEFAULT_OPTIONS } from "@/lib/job-config";
import { parseSubmission } from "@/lib/job-submission";
import type { DashboardFormState, DashboardSubmission, PolledJobResult, RecentJob } from "@/types/dashboard";
import Header from "./Header";
import SourceInputPanel from "./SourceInputPanel";
import ConfigurationPanel from "./ConfigurationPanel";
import DeliverableSelector from "./DeliverableSelector";
import JobStatusTracker from "./JobStatusTracker";
import DeliverablesViewer from "./DeliverablesViewer";
import { useJobPolling } from "./useJobPolling";

const HISTORY_KEY = "synthetix.jobs.v1";
function initialForm(): DashboardFormState {
  return { sourceMode: "url", sourceUrl: "", sourceText: "", inputMimeType: "article/url", outputTypes: ["executive_summary", "linkedin_post"], options: { ...DEFAULT_OPTIONS }, processing: "automatic" };
}
function submission(form: DashboardFormState): DashboardSubmission {
  return {
    sourceUrls: form.sourceMode === "url" ? [form.sourceUrl.trim()] : [],
    ...(form.sourceMode === "text" ? { sourceText: form.sourceText } : {}),
    inputMimeType: form.sourceMode === "text" ? "text/plain" : form.inputMimeType,
    outputTypes: form.outputTypes,
    options: form.options,
    ...(form.processing === "deep" ? { tier: "PREMIUM" as const } : {})
  };
}

export default function OperatorDashboard(): React.JSX.Element {
  const [form, setForm] = useState<DashboardFormState>(initialForm);
  const [jobId, setJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<RecentJob[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const onResult = useCallback((job: PolledJobResult) => {
    setHistory((items) => items.map((item) => item.id === job.id && item.status !== job.status ? { ...item, status: job.status } : item));
  }, []);
  const { job, error: connectionError, retry } = useJobPolling(jobId, onResult);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "null");
      if (saved && typeof saved === "object" && "jobs" in saved && Array.isArray(saved.jobs)) {
        const jobs = saved.jobs.filter((item): item is RecentJob => item && typeof item.id === "string" && item.id.length <= 128 && typeof item.label === "string" && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) && ["PENDING", "EXTRACTING", "ROUTING", "GENERATING", "FORMATTING", "COMPLETED", "FAILED"].includes(item.status)).slice(0, 20);
        setHistory(jobs);
        if ("selected" in saved && typeof saved.selected === "string" && jobs.some((item) => item.id === saved.selected)) setJobId(saved.selected);
      }
    } catch { /* Storage may be disabled or contain an old version. */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify({ jobs: history, selected: jobId })); } catch { /* Jobs still work without local persistence. */ }
  }, [history, jobId, hydrated]);
  const updateForm = (patch: Partial<DashboardFormState>) => { setForm((current) => ({ ...current, ...patch })); setSubmitError(null); };
  let validationError: string | null = null;
  try { parseSubmission(submission(form)); } catch (error) { validationError = error instanceof Error ? error.message : "Review your source and deliverables"; }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    let payload: DashboardSubmission;
    try { payload = parseSubmission(submission(form)) as DashboardSubmission; }
    catch (error) { setSubmitError(error instanceof Error ? error.message : "Review your input"); return; }
    submittingRef.current = true; setSubmitting(true); setSubmitError(null);
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "We couldn’t submit this job. Please try again.");
      if (!result || typeof result !== "object" || !("jobId" in result) || typeof result.jobId !== "string") throw new Error("The server did not return a job ID. Check recent jobs before retrying.");
      const id = result.jobId;
      const label = form.sourceMode === "text" ? "Text transformation" : new URL(form.sourceUrl).hostname;
      setHistory((items) => [{ id, label, status: "PENDING" as const, createdAt: new Date().toISOString() }, ...items].slice(0, 20));
      setJobId(id);
      setTimeout(() => document.getElementById("pipeline")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 50);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Unable to reach the server. Please try again."); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }
  function reset() {
    if (submittingRef.current) return;
    setForm(initialForm()); setJobId(null); setSubmitError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return <div className="min-h-screen">
    <a href="#workspace" className="skip-link">Skip to workspace</a>
    <Header history={history} onReset={reset} onSelectJob={setJobId} />
    <main className="mx-auto max-w-[1440px] px-5 pb-12 pt-9 sm:px-8 xl:px-12" id="workspace">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><div className="mb-4 flex items-center gap-2 text-[10px] font-medium tracking-[0.15em] text-slate-500"><span>WORKSPACE</span><ArrowRight size={11} /><span className="text-indigo-300">NEW TRANSFORMATION</span></div><h1 className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-[38px]">Turn your source into <span className="text-indigo-300">what’s next.</span></h1><p className="mt-3 text-sm leading-6 text-slate-400">Create considered, channel-ready content from the material that matters.</p></div><div className="flex items-center gap-2 text-[11px] text-slate-500"><Layers3 size={15} aria-hidden="true" />One source<ArrowRight size={12} />Multiple possibilities</div></div>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]"><div className="min-w-0 space-y-6"><SourceInputPanel form={form} onChange={updateForm} disabled={submitting} /><DeliverableSelector selected={form.outputTypes} onChange={(outputTypes) => updateForm({ outputTypes })} disabled={submitting} /></div><div className="min-w-0 lg:sticky lg:top-6"><ConfigurationPanel form={form} onChange={updateForm} submitting={submitting} valid={!validationError} />{validationError && <p className="px-2 pt-3 text-center text-xs text-slate-500">{validationError}</p>}{submitError && <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm leading-6 text-rose-200">{submitError}</div>}</div></div>
      </form>
      {jobId ? <div className="mt-8 space-y-6"><JobStatusTracker jobId={jobId} job={job} connectionError={connectionError} onRetry={retry} />{job?.status === "COMPLETED" && job.finalDeliverables && <DeliverablesViewer key={job.id} job={job} />}</div> : <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-800 px-6 py-5 text-xs text-slate-500"><span className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-slate-700" />Your pipeline and generated content will appear here.</span><span className="flex items-center gap-2">Ready when you are<ArrowDown size={14} /></span></div>}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/70 pt-6 text-[10px] text-slate-500"><span>SYNTHTX / CONTENT TRANSFORMATION ENGINE</span><span className="flex items-center gap-2"><LockKeyhole size={12} aria-hidden="true" />Review generated content before publication.</span></footer>
    </main>
  </div>;
}
