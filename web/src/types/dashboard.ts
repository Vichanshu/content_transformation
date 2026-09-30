import type { JobSubmissionPayload, OutputType } from "@/types";
import type { GenerationOptions } from "@/lib/job-config";

export type JobStatus = "PENDING" | "EXTRACTING" | "ROUTING" | "GENERATING" | "FORMATTING" | "COMPLETED" | "FAILED";
export type ProcessingPreference = "automatic" | "deep";

export interface DashboardFormState {
  sourceMode: "url" | "text";
  sourceUrl: string;
  sourceText: string;
  inputMimeType: string;
  outputTypes: OutputType[];
  options: GenerationOptions;
  processing: ProcessingPreference;
}

export interface DashboardSubmission extends JobSubmissionPayload {
  options: GenerationOptions;
}

export interface PolledJobResult {
  id: string;
  status: JobStatus;
  complexityScore: number | null;
  selectedTier: "STANDARD" | "PREMIUM" | null;
  finalDeliverables: Partial<Record<OutputType, unknown>> | null;
  errorMessage: string | null;
  outputTypes: OutputType[];
  createdAt: string;
  updatedAt: string;
}

export interface RecentJob {
  id: string;
  label: string;
  status: JobStatus;
  createdAt: string;
}

export interface SystemStatus {
  worker: "online" | "offline" | "unconfigured";
  orchestrator: "online" | "offline" | "configured" | "unconfigured";
}
