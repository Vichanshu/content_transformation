# Routes

Framework: Next.js 15 App Router with React 19. The operator dashboard is the only user-facing page.

| URL | Component | Layout | Summary |
| --- | --- | --- | --- |
| / | `web/src/app/page.tsx` → `OperatorDashboard` | `web/src/app/layout.tsx` | Source entry, deliverable selection, controls, tracker, previews |
| /api/jobs | `web/src/app/api/jobs/route.ts` | API | Submit jobs |
| /api/jobs/[id] | `web/src/app/api/jobs/[id]/route.ts` | API | Poll job results |
| /api/system/status | `web/src/app/api/system/status/route.ts` | API | Worker and orchestrator health |
| /api/inngest | `web/src/app/api/inngest/route.ts` | API | Inngest handler |

## web/src/app/page.tsx

Full home route source.

```tsx
import OperatorDashboard from "@/components/dashboard/OperatorDashboard";

export default function Home(): React.JSX.Element {
  return <OperatorDashboard />;
}

```
