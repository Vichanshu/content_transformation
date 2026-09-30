# Design tokens

## Compact summary

- Dark-first background `hsl(224 45% 6%)`, foreground `hsl(210 29% 96%)`, card `hsl(224 34% 10%)`, border `hsl(218 24% 19%)`, muted `hsl(218 15% 63%)`, indigo accent `hsl(239 84% 72%)`.
- Surface examples: header `#0b0f1a`, panel `#101522`, darkest input `slate-950`; success emerald, failure rose, warning amber.
- Font stack: Inter, Segoe UI, Arial, sans-serif; monospace for section numbers and pipeline metrics. Headline 30–38px; section title 16px; body 12–14px.
- Tailwind default spacing and breakpoints; content max width 1440px, responsive grid changes at `lg` (1024px).
- Radius: panel 16px, selected cards 12px, inputs/buttons 8–12px. Subtle borders and shadow-sm; indigo CTA glow.
- Motion: small hover transitions; reduced-motion media override.

## Raw sources

## web/tailwind.config.ts

Full Tailwind configuration.

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))"
      }
    }
  },
  plugins: []
};

export default config;

```
## web/src/app/globals.css

Full global token and component-class stylesheet.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --background: 224 45% 6%;
  --foreground: 210 29% 96%;
  --card: 224 34% 10%;
  --border: 218 24% 19%;
  --muted: 218 15% 63%;
  --accent: 239 84% 72%;
}
* { @apply border-border; }
html { scroll-behavior: smooth; }
body { @apply bg-background text-foreground antialiased; font-family: "Inter", "Segoe UI", Arial, sans-serif; }
::selection { background: hsl(var(--accent) / 0.3); }
button, input, select, textarea, summary, a { -webkit-tap-highlight-color: transparent; }
:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 4px; }
button:disabled { cursor: not-allowed; opacity: 0.45; }

@layer components {
  .panel { @apply rounded-2xl border border-slate-800/80 bg-[#101522] p-6 shadow-sm sm:p-7; }
  .section-heading { @apply flex items-start gap-3; }
  .section-heading h2 { @apply text-base font-semibold tracking-tight text-slate-100; }
  .section-heading p { @apply mt-1.5 text-xs leading-5 text-slate-400; }
  .section-number { @apply mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-indigo-500/20 bg-indigo-500/10 font-mono text-[10px] text-indigo-300; }
  .eyebrow { @apply text-[9px] font-semibold tracking-[0.19em] text-indigo-300; }
  .field-label { @apply mb-2 block text-xs font-medium text-slate-300; }
  .field-input { @apply w-full rounded-lg border border-slate-700/70 bg-slate-950/50 px-3.5 py-3 text-[13px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-400/10 disabled:opacity-50; }
  .source-tab { @apply inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-xs font-medium text-slate-500 transition hover:text-slate-200; }
  .source-tab-active { @apply bg-slate-800 text-slate-100 shadow-sm; }
  .count-badge { @apply shrink-0 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-medium text-indigo-300; }
  .deliverable-card { @apply rounded-xl border border-slate-800 bg-slate-950/20 p-4 text-left transition duration-200 hover:border-slate-600 hover:bg-slate-800/30; }
  .deliverable-card-selected { @apply border-indigo-500/50 bg-indigo-500/[0.07] hover:border-indigo-400/70 hover:bg-indigo-500/10; }
  .icon-tile { @apply flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/50; }
  .selection-mark { @apply flex h-[18px] w-[18px] items-center justify-center rounded-full border border-slate-700 text-slate-600; }
  .selection-mark-active { @apply border-indigo-400 bg-indigo-500 text-white; }
  .primary-button { @apply flex items-center justify-center gap-3 rounded-xl border border-indigo-400/30 bg-indigo-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_4px_24px_-8px_rgba(99,102,241,0.5)] transition hover:bg-indigo-400 disabled:shadow-none; }
  .secondary-button { @apply inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white; }
  .icon-button { @apply flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white; }
  .status-dot { @apply h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600; }
  .status-dot-online { @apply bg-emerald-400 shadow-[0_0_8px_0_rgba(52,211,153,0.25)]; }
  .metric-badge { @apply inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400; }
  .stage-circle { @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950 font-mono text-[10px] text-slate-600; }
  .stage-done { @apply border-indigo-500/30 bg-indigo-500/10 text-indigo-300; }
  .stage-active { @apply border-indigo-400/70 bg-indigo-500/15 text-indigo-200 ring-4 ring-indigo-500/5; }
  .preview-label { @apply text-[10px] font-semibold tracking-[0.14em] text-slate-500; }
  .history-dialog { @apply m-auto w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#101522] p-0 text-slate-100 shadow-2xl; }
  .skip-link { @apply fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-indigo-500 px-4 py-3 text-sm text-white focus:translate-y-0; }
}
.history-dialog::backdrop { background: rgba(2,6,23,0.8); backdrop-filter: blur(5px); }
.loading-ring { width: 16px; height: 16px; border: 2px solid #ffffff55; border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.markdown-preview { color: #cbd5e1; font-size: 14px; line-height: 1.85; overflow-wrap: anywhere; }
.markdown-preview h1 { color: #f8fafc; font-size: 28px; line-height: 1.3; font-weight: 600; margin: 0 0 24px; letter-spacing: -0.03em; }
.markdown-preview h2 { color: #e2e8f0; font-size: 19px; font-weight: 600; margin: 30px 0 12px; }
.markdown-preview h3, .markdown-preview h4 { color: #e2e8f0; font-size: 16px; font-weight: 600; margin: 22px 0 10px; }
.markdown-preview p { margin: 12px 0; }
.markdown-preview ul, .markdown-preview ol { padding-left: 24px; margin: 16px 0; }
.markdown-preview ul { list-style-type: disc; }
.markdown-preview ol { list-style-type: decimal; }
.markdown-preview li { margin: 7px 0; }
.markdown-preview a { color: #a5b4fc; text-decoration: underline; text-underline-offset: 3px; }
.markdown-preview strong { color: #f1f5f9; }
.markdown-preview blockquote { border-left: 2px solid #818cf8; padding-left: 20px; color: #94a3b8; }
.markdown-preview pre { overflow-x: auto; padding: 16px; background: #020617; border-radius: 8px; }
.markdown-preview code { font-size: 12px; background: #0b1020; padding: 2px 4px; border-radius: 3px; }
.markdown-preview table { display: block; overflow-x: auto; border-collapse: collapse; margin: 20px 0; }
.markdown-preview th, .markdown-preview td { border: 1px solid #334155; padding: 10px 14px; text-align: left; }
.markdown-preview th { background: #151d2d; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

```
