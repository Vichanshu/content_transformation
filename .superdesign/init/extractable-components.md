# Extractable components

## Header
- Source: `web/src/components/dashboard/Header.tsx`
- Category: layout
- Description: Dark brand header with service health and recent jobs dialog.
- Extractable props: history count, worker/orchestrator status, onReset/onSelectJob action states.
- Hardcoded: Synthetix wordmark, Lucide Waypoints/History/Plus icons, slate and indigo classes. No separate image logo asset exists.

## Other dashboard panels
SourceInputPanel, ConfigurationPanel, DeliverableSelector, JobStatusTracker, and DeliverablesViewer are page-specific panels used only on the operator dashboard. They are not currently shared across routes, so do not extract them as reusable Superdesign components yet.
