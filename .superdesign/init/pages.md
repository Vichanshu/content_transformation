# Page dependency trees

## / (Operator Dashboard)
Entry: `web/src/app/page.tsx`
Layout: `web/src/app/layout.tsx` → `web/src/app/globals.css`
Dependencies:
- `web/src/components/dashboard/OperatorDashboard.tsx`
  - `web/src/components/dashboard/Header.tsx`
    - `web/src/types/dashboard.ts`
  - `web/src/components/dashboard/SourceInputPanel.tsx`
    - `web/src/lib/job-config.ts`
    - `web/src/types/dashboard.ts`
  - `web/src/components/dashboard/ConfigurationPanel.tsx`
    - `web/src/lib/job-config.ts`
    - `web/src/types/dashboard.ts`
  - `web/src/components/dashboard/DeliverableSelector.tsx`
    - `web/src/components/dashboard/catalog.ts`
      - `web/src/types/index.ts`
  - `web/src/components/dashboard/JobStatusTracker.tsx`
    - `web/src/types/dashboard.ts`
  - `web/src/components/dashboard/DeliverablesViewer.tsx`
    - `web/src/components/dashboard/catalog.ts`
    - `web/src/lib/formatters.ts`
    - `web/src/types/index.ts`
    - `web/src/types/dashboard.ts`
  - `web/src/components/dashboard/useJobPolling.ts`
    - `web/src/types/dashboard.ts`
  - `web/src/lib/job-config.ts`
  - `web/src/lib/job-submission.ts`
    - `web/src/lib/job-config.ts`
    - `web/src/types/index.ts`
  - `web/src/types/dashboard.ts`

Design context should prioritize the page, layout, dashboard component render branches, catalog, globals.css, and Tailwind configuration; backend validation and formatters are behavior context rather than visual source.
