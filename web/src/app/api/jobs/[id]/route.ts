import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { id } = await params;
  if (!id || id.length > 128) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }
  const job = await db.job.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      complexityScore: true,
      finalDeliverables: true,
      selectedTier: true,
      errorMessage: true,
      outputTypes: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job, { status: 200, headers: { "Cache-Control": "no-store" } });
}
