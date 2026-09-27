import { EventSchemas, Inngest } from "inngest";

import type { JobSubmittedEventData } from "@/types";

export const inngest = new Inngest({
  id: "content-transformation-engine",
  schemas: new EventSchemas().fromRecord<{
    "engine/job.submitted": { data: JobSubmittedEventData };
  }>()
});
