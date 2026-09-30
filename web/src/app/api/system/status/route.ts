import { NextResponse } from "next/server";
import type { SystemStatus } from "@/types/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function reachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2500), redirect: "error" });
    return response.ok;
  } catch { return false; }
}

export async function GET(): Promise<NextResponse<SystemStatus>> {
  const workerUrl = process.env.WORKER_INTERNAL_URL;
  const devUrl = process.env.INNGEST_DEV_SERVER_URL || (process.env.INNGEST_DEV?.startsWith("http") ? process.env.INNGEST_DEV : undefined);
  const [workerOnline, orchestratorOnline] = await Promise.all([
    workerUrl ? reachable(`${workerUrl.replace(/\/$/, "")}/health`) : false,
    devUrl ? reachable(devUrl) : false
  ]);
  return NextResponse.json({
    worker: !workerUrl ? "unconfigured" : workerOnline ? "online" : "offline",
    orchestrator: devUrl ? (orchestratorOnline ? "online" : "offline") : process.env.INNGEST_EVENT_KEY ? "configured" : "unconfigured"
  }, { headers: { "Cache-Control": "no-store" } });
}
