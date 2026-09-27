import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { processTransformationJob } from "@/inngest/functions/transformEngine";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processTransformationJob]
});
