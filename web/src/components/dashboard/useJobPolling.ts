"use client";
import { useEffect, useState } from "react";
import type { PolledJobResult } from "@/types/dashboard";

const STATUSES = new Set(["PENDING", "EXTRACTING", "ROUTING", "GENERATING", "FORMATTING", "COMPLETED", "FAILED"]);
export function useJobPolling(jobId: string | null, onResult: (job: PolledJobResult) => void) {
  const [job, setJob] = useState<PolledJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setJob(null);
    setError(null);
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll() {
      let terminal = false;
      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId!)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          terminal = response.status === 404;
          throw new Error(terminal ? "This job could not be found. Start a new transformation or select another job." : "We couldn’t refresh this job. Reconnecting automatically…");
        }
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("id" in result) || result.id !== jobId || !("status" in result) || !STATUSES.has(String(result.status)) || !("createdAt" in result) || typeof result.createdAt !== "string" || !("updatedAt" in result) || typeof result.updatedAt !== "string") {
          throw new Error("The server returned an unreadable job status. Retrying…");
        }
        const next = result as PolledJobResult;
        terminal = next.status === "COMPLETED" || next.status === "FAILED";
        if (!cancelled) { setJob(next); setError(null); onResult(next); }
      } catch (cause: unknown) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Connection interrupted. Retrying…");
      } finally {
        if (!cancelled && !terminal) timer = setTimeout(poll, 2500);
      }
    }
    void poll();
    return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [jobId, onResult, attempt]);
  return { job, error, retry: () => setAttempt((value) => value + 1) };
}
