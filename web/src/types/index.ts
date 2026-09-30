export type InputType = "document" | "video" | "audio" | "text";

export type OutputType =
  | "video_script"
  | "storyboard"
  | "linkedin_post"
  | "tweet_thread"
  | "strategic_advisory"
  | "slide_deck"
  | "executive_summary"
  | "infographic";

export interface JobSubmittedEventData {
  jobId: string;
  payload?: JobSubmissionPayload;
}

export interface JobSubmissionPayload {
  sourceUrls: string[];
  sourceText?: string;
  inputMimeType: string;
  outputTypes: OutputType[];
  tier?: "STANDARD" | "PREMIUM";
  options?: Record<string, unknown>;
}

export interface NormalizedContext {
  job_id: string;
  source_type: "document" | "video" | "audio" | "hybrid";
  title: string | null;
  word_count: number;
  content_markdown: string;
  tables: Array<{ caption: string | null; headers: string[]; rows: string[][] }>;
  timeline: Array<{
    start_seconds: number;
    end_seconds: number;
    speaker: string | null;
    text: string;
  }>;
  headings: Array<{ level: number; text: string }>;
  metadata: Record<string, unknown>;
}
