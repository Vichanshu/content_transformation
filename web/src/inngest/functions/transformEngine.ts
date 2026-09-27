import axios from "axios";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";
import {
  aggregateMoAResults,
  DEFAULT_CONTEXT_MAX_CHARACTERS,
  evaluateComplexity,
  generateMoASpecialist,
  generateSingleAgent,
  prepareBudgetedContext
} from "@/lib/litellm";
import type {
  JobSubmittedEventData,
  NormalizedContext,
  OutputType
} from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNormalizedContext(value: unknown): value is NormalizedContext {
  if (!isRecord(value)) return false;
  const result = value;
  const validSourceTypes = ["document", "video", "audio", "hybrid"];
  return (
    typeof result.job_id === "string" &&
    validSourceTypes.includes(result.source_type as string) &&
    (result.title === null || typeof result.title === "string") &&
    typeof result.word_count === "number" &&
    Number.isFinite(result.word_count) &&
    result.word_count >= 0 &&
    typeof result.content_markdown === "string" &&
    Array.isArray(result.tables) &&
    result.tables.every(
      (table: unknown) =>
        isRecord(table) &&
        (table.caption === null || typeof table.caption === "string") &&
        isStringArray(table.headers) &&
        Array.isArray(table.rows) &&
        table.rows.every(isStringArray)
    ) &&
    Array.isArray(result.timeline) &&
    result.timeline.every(
      (segment: unknown) =>
        isRecord(segment) &&
        typeof segment.start_seconds === "number" &&
        typeof segment.end_seconds === "number" &&
        Number.isFinite(segment.start_seconds) &&
        Number.isFinite(segment.end_seconds) &&
        segment.start_seconds >= 0 &&
        segment.end_seconds >= segment.start_seconds &&
        (segment.speaker === null || typeof segment.speaker === "string") &&
        typeof segment.text === "string"
    ) &&
    Array.isArray(result.headings) &&
    result.headings.every(
      (heading: unknown) =>
        isRecord(heading) &&
        typeof heading.level === "number" &&
        Number.isInteger(heading.level) &&
        heading.level >= 1 &&
        typeof heading.text === "string"
    ) &&
    isRecord(result.metadata)
  );
}

function safeErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status
      ? `Worker extraction failed with HTTP ${status}`
      : "Worker extraction request failed";
  }
  return error instanceof Error ? error.message.slice(0, 2000) : "Unknown extraction failure";
}

async function loadNormalizedContext(jobId: string): Promise<NormalizedContext> {
  const job = await db.job.findUniqueOrThrow({
    where: { id: jobId },
    select: { normalizedContext: true }
  });
  if (
    !isNormalizedContext(job.normalizedContext) ||
    job.normalizedContext.job_id !== jobId
  ) {
    throw new Error("Job has no valid normalized context");
  }
  return job.normalizedContext;
}

async function storeGenerationDraft(
  jobId: string,
  outputType: OutputType,
  persona: string,
  content: string
): Promise<void> {
  await db.generationDraft.upsert({
    where: {
      jobId_outputType_persona: { jobId, outputType, persona }
    },
    create: { jobId, outputType, persona, content },
    update: { content }
  });
}

async function generateAndStoreSpecialist(
  jobId: string,
  outputType: OutputType,
  persona: string,
  role: string
): Promise<{ outputType: OutputType; persona: string }> {
  const context = await loadNormalizedContext(jobId);
  const draft = await generateMoASpecialist(context, outputType, role);
  await storeGenerationDraft(jobId, outputType, persona, draft);
  return { outputType, persona };
}

export const processTransformationJob = inngest.createFunction(
  {
    id: "process-transformation-job",
    retries: 3,
    onFailure: async ({ event, error, step }) => {
      const original = event.data.event as
        | { data?: JobSubmittedEventData }
        | undefined;
      const jobId = original?.data?.jobId;
      if (!jobId) return;
      await step.run("record-extraction-failure", async () => {
        const message = safeErrorMessage(error);
        await db.$transaction([
          db.job.update({
            where: { id: jobId },
            data: { status: "FAILED", errorMessage: message }
          }),
          db.log.create({
            data: { jobId, level: "ERROR", message }
          })
        ]);
      });
    }
  },
  { event: "engine/job.submitted" },
  async ({ event, step }) => {
    const { jobId } = event.data;

    await step.run("mark-extracting", async () => {
      await db.$transaction([
        db.job.update({
          where: { id: jobId },
          data: { status: "EXTRACTING", errorMessage: null }
        }),
        db.log.create({
          data: { jobId, level: "INFO", message: "Extraction started" }
        })
      ]);
    });

    const extraction = await step.run("extract-content", async () => {
      const job = await db.job.findUniqueOrThrow({
        where: { id: jobId },
        select: { id: true, inputUrl: true }
      });
      const workerUrl = process.env.WORKER_INTERNAL_URL;
      if (!workerUrl) throw new Error("WORKER_INTERNAL_URL is not configured");
      try {
        const response = await axios.post<unknown>(
          `${workerUrl.replace(/\/$/, "")}/api/extract/auto`,
          { job_id: jobId, source_url: job.inputUrl },
          { timeout: 180_000 }
        );
        if (!isNormalizedContext(response.data) || response.data.job_id !== jobId) {
          throw new Error("Worker returned an invalid normalized payload");
        }
        const extracted = response.data;
        await db.job.update({
          where: { id: job.id },
          data: {
            normalizedContext: extracted as unknown as Prisma.InputJsonValue,
            extractedTables: extracted.tables as Prisma.InputJsonValue,
            timeline: extracted.timeline as Prisma.InputJsonValue
          }
        });
        return {
          jobId: job.id,
          wordCount: extracted.word_count,
          hasVideo: extracted.timeline.length > 0
        };
      } catch (error: unknown) {
        throw new Error(safeErrorMessage(error), { cause: error });
      }
    });

    await step.run("persist-normalized-content", async () => {
      await db.$transaction([
        db.job.update({
          where: { id: jobId },
          data: {
            status: "ROUTING",
            errorMessage: null
          }
        }),
        db.log.create({
          data: {
            jobId,
            level: "INFO",
            message: `Extraction completed: ${extraction.wordCount} words`
          }
        })
      ]);
    });

    const generationInput = await step.run("load-generation-input", async () => {
      const job = await db.job.findUniqueOrThrow({
        where: { id: jobId },
        select: { outputTypes: true }
      });
      const context = await loadNormalizedContext(jobId);
      const budgeted = prepareBudgetedContext(context);
      const supportedTypes: OutputType[] = [
        "video_script",
        "storyboard",
        "linkedin_post",
        "tweet_thread",
        "strategic_advisory",
        "slide_deck",
        "executive_summary"
      ];
      const rawTypes = job.outputTypes;
      if (
        !Array.isArray(rawTypes) ||
        rawTypes.length === 0 ||
        !rawTypes.every(
          (value: unknown) =>
            typeof value === "string" &&
            supportedTypes.includes(value as OutputType)
        )
      ) {
        throw new Error("Job has no valid output types");
      }
      return {
        jobId,
        outputTypes: [...new Set(rawTypes as OutputType[])],
        contextLength: budgeted.originalCharacters,
        truncated: budgeted.truncated
      };
    });

    const complexity = await step.run("evaluate-complexity", async () =>
      evaluateComplexity(
        generationInput.outputTypes,
        generationInput.contextLength
      )
    );

    await step.run("mark-generating", async () => {
      await db.$transaction([
        db.job.update({
          where: { id: jobId },
          data: {
            status: "GENERATING",
            complexityScore: complexity.score,
            selectedTier:
              complexity.pipeline === "multi" ? "PREMIUM" : "STANDARD",
            generationMetadata: {
              truncated: generationInput.truncated,
              originalCharacters: generationInput.contextLength,
              maxCharacters: DEFAULT_CONTEXT_MAX_CHARACTERS
            }
          }
        }),
        db.log.create({
          data: {
            jobId,
            level: "INFO",
            message: `Generation routed to ${complexity.pipeline} pipeline (score ${complexity.score}/10): ${complexity.rationale.slice(0, 500)}`
          }
        })
      ]);
    });

    for (const outputType of generationInput.outputTypes) {
      if (complexity.pipeline === "single") {
        await step.run(`generate-${outputType}`, async () => {
          const context = await loadNormalizedContext(jobId);
          const draft = await generateSingleAgent(context, outputType);
          await storeGenerationDraft(jobId, outputType, "single", draft);
          return { outputType, persona: "single" };
        });
      } else {
        await Promise.all([
          step.run(`specialist-${outputType}-writer`, async () =>
            generateAndStoreSpecialist(jobId, outputType, "writer", "Writer")
          ),
          step.run(`specialist-${outputType}-critic`, async () =>
            generateAndStoreSpecialist(
              jobId,
              outputType,
              "critic",
              "Tone and Accuracy Critic"
            )
          ),
          step.run(`specialist-${outputType}-strategist`, async () =>
            generateAndStoreSpecialist(
              jobId,
              outputType,
              "strategist",
              "Audience Strategist"
            )
          )
        ]);
        await step.run(`aggregate-moa-${outputType}`, async () => {
          const specialists = await db.generationDraft.findMany({
            where: {
              jobId,
              outputType,
              persona: { in: ["writer", "critic", "strategist"] }
            },
            select: { persona: true, content: true }
          });
          if (specialists.length !== 3) {
            throw new Error(`Missing specialist drafts for ${outputType}`);
          }
          const drafts = Object.fromEntries(
            specialists.map(({ persona, content }) => [persona, content])
          ) as Record<string, string>;
          const context = await loadNormalizedContext(jobId);
          const sourceEvidence = prepareBudgetedContext(context).sourceEvidence;
          const draft = await aggregateMoAResults(
            drafts,
            outputType,
            sourceEvidence
          );
          await storeGenerationDraft(jobId, outputType, "aggregate", draft);
          return { outputType, persona: "aggregate" };
        });
      }
    }

    await step.run("save-draft-deliverables", async () => {
      const persona = complexity.pipeline === "multi" ? "aggregate" : "single";
      const savedDrafts = await db.generationDraft.findMany({
        where: { jobId, persona },
        select: { outputType: true, content: true }
      });
      const draftDeliverables: Partial<Record<OutputType, string>> = {};
      for (const outputType of generationInput.outputTypes) {
        const draft = savedDrafts.find((item) => item.outputType === outputType);
        if (!draft) throw new Error(`Missing ${persona} draft for ${outputType}`);
        draftDeliverables[outputType] = draft.content;
      }
      await db.$transaction([
        db.job.update({
          where: { id: jobId },
          data: {
            draftDeliverables:
              draftDeliverables as unknown as Prisma.InputJsonValue
          }
        }),
        db.log.create({
          data: {
            jobId,
            level: "INFO",
            message: `Generated drafts for ${generationInput.outputTypes.join(", ")}`
          }
        })
      ]);
      return { jobId, outputCount: generationInput.outputTypes.length };
    });

    return { jobId, status: "drafts-ready" as const };
  }
);
