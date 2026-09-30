import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { parseSubmission } from "@/lib/job-submission";
import type { JobSubmissionPayload } from "@/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 1_048_576) {
    return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
  }
  let payload: JobSubmissionPayload;
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Request body is empty");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) {
        await reader.cancel();
        return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    payload = parseSubmission(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid JSON request" },
      { status: 400 }
    );
  }

  const job = await db.job.create({
    data: {
      status: "PENDING",
      inputUrl: payload.sourceUrls[0] ?? null,
      inputText: payload.sourceText ?? null,
      inputMimeType: payload.inputMimeType,
      outputTypes: payload.outputTypes as Prisma.InputJsonValue,
      requestedTier: payload.tier,
      requestOptions: payload.options as Prisma.InputJsonValue | undefined,
      logs: { create: { level: "INFO", message: "Job submitted" } }
    },
    select: { id: true }
  });
  try {
    await inngest.send({
      name: "engine/job.submitted",
      id: `job-${job.id}`,
      data: { jobId: job.id }
    });
  } catch {
    await db.$transaction([
      db.job.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: "Could not dispatch job" }
      }),
      db.log.create({
        data: { jobId: job.id, level: "ERROR", message: "Job dispatch failed" }
      })
    ]);
    return NextResponse.json(
      { jobId: job.id, status: "FAILED", error: "Could not dispatch job" },
      { status: 503 }
    );
  }
  return NextResponse.json({ jobId: job.id, status: "PENDING" }, { status: 201 });
}
