# Synthetix Engine design system

## Product and audience

Synthetix Engine is an operator workspace for transforming documents, video, audio, URLs, and pasted text into publication-ready content. Operators choose a source, configure audience and editorial intent, select output formats, monitor an asynchronous extraction and generation pipeline, then review and export deliverables. The current application has one dashboard route at `/`, with a service-status header, source panel, deliverable selector, configuration panel, pipeline tracker, and output viewer.

The UI should serve knowledge workers and content teams handling complex source material. It favors clear status, readable source and output content, and deliberate controls over decorative marketing patterns.

## Visual foundations

- Dark mode only. Page background `hsl(224 45% 6%)`; foreground `hsl(210 29% 96%)`; panel background `#101522`; header background `#0b0f1a`; border `hsl(218 24% 19%)`.
- Indigo accent `hsl(239 84% 72%)`, with `#a5b4fc` focus outlines. Emerald indicates online/completed, rose indicates failure, and amber indicates preview warnings.
- Font stack: Inter, Segoe UI, Arial, sans-serif. Use a restrained monospace accent for section numbers, compact labels, and pipeline metrics.
- Typography: page heading 30–38px semibold; panel headings 16px semibold; controls and content 12–14px. Text contrast must remain strong against dark surfaces.
- Layout: maximum content width 1440px; 20–48px horizontal padding by breakpoint. Desktop pairs source/deliverables on the left with a 360–390px configuration column on the right. Stack panels on smaller screens.
- Surfaces: 16px panel radius, 12px card radius, 8–12px control radius, subtle slate borders and shadow. The primary action uses indigo fill and a restrained indigo glow.
- Icons: Lucide React line icons. Brand currently uses a Lucide Waypoints symbol beside the `synthetix / engine` wordmark; no separate image logo asset exists.
- Motion: short hover transitions and a simple loading ring. Respect `prefers-reduced-motion`.

## UI patterns

1. Number each major form section in a small indigo mono badge.
2. Present source mode as a two-choice segmented control; expose MIME type for URL sources.
3. Use selectable deliverable cards with a clear selected border and check marker.
4. Keep processing options legible and show one prominent Generate action.
5. Make pipeline states explicit: PENDING, EXTRACTING, ROUTING, GENERATING, FORMATTING, COMPLETED or FAILED. Avoid fake progress percentages.
6. Preview each final format in the way an operator will use it: scene timeline, social post, markdown document, slide cards, or infographic specification. Include copy and export actions.
7. Display honest service health; when an integration is unconfigured, label it as such.

## Source of truth

Use `web/src/app/globals.css`, `web/tailwind.config.ts`, and the dashboard components as the exact implementation reference. Keep source behavior and text labels intact when reproducing the current interface. An exploration may change layout only after the faithful baseline has been saved.
