"use client";

import { useLayoutEffect, useRef } from "react";
import { AlignLeft, ArrowUpRight, FileText, Link2 } from "lucide-react";
import { MAX_TEXT_CHARACTERS } from "@/lib/job-config";
import type { DashboardFormState } from "@/types/dashboard";

interface Props {
  form: DashboardFormState;
  onChange: (patch: Partial<DashboardFormState>) => void;
  disabled: boolean;
}

export function inferMimeType(source: string): string {
  try {
    const url = new URL(source);
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(url.hostname.toLowerCase())) return "video/mp4";
    const path = url.pathname.toLowerCase();
    if (/\.pdf$/.test(path)) return "application/pdf";
    if (/\.(mp4|mov)$/.test(path)) return "video/mp4";
    if (/\.(mp3|wav)$/.test(path)) return "audio/mpeg";
    if (/\.pptx$/.test(path)) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (/\.docx$/.test(path)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (/\.(txt|md)$/.test(path)) return "text/plain";
  } catch { /* The URL may still be incomplete while typing. */ }
  return "article/url";
}

export default function SourceInputPanel({ form, onChange, disabled }: Props): React.JSX.Element {
  const textRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = "auto";
      textRef.current.style.height = `${Math.min(440, Math.max(200, textRef.current.scrollHeight))}px`;
    }
  }, [form.sourceText, form.sourceMode]);
  return (
    <section className="panel" aria-labelledby="source-heading">
      <div className="section-heading">
        <span className="section-number">01</span>
        <div><h2 id="source-heading">Start with your source</h2><p>One piece of content. A whole new set of possibilities.</p></div>
      </div>
      <fieldset className="mt-6 inline-flex rounded-lg border border-slate-800 bg-slate-950/70 p-1">
        <legend className="sr-only">Source mode</legend>
        {([{ mode: "url", label: "URL / remote media", icon: Link2 }, { mode: "text", label: "Raw text / prompt", icon: AlignLeft }] as const).map(({ mode, label, icon: Icon }) => (
          <label key={mode} className={`source-tab cursor-pointer focus-within:ring-2 focus-within:ring-indigo-400 ${form.sourceMode === mode ? "source-tab-active" : ""}`}><input type="radio" name="source-mode" value={mode} className="sr-only" disabled={disabled} checked={form.sourceMode === mode} onChange={() => onChange({ sourceMode: mode })} /><Icon size={15} aria-hidden="true" />{label}</label>
        ))}
      </fieldset>
      {form.sourceMode === "url" ? (
        <div className="mt-5">
          <label htmlFor="source-url" className="field-label">Source URL</label>
          <div className="relative"><Link2 size={18} className="pointer-events-none absolute left-4 top-4 text-slate-500" aria-hidden="true" /><input id="source-url" type="url" autoComplete="off" disabled={disabled} value={form.sourceUrl} onChange={(event) => onChange({ sourceUrl: event.target.value, inputMimeType: inferMimeType(event.target.value) })} className="field-input min-h-12 pl-11" placeholder="https://example.com/your-source.pdf" aria-describedby="source-help" /></div>
          <p id="source-help" className="mt-3 text-xs leading-5 text-slate-400">Public article, document, direct media file, or YouTube transcript.</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800/70 bg-slate-950/40 p-3">
            <span className="flex items-center gap-2 text-xs text-slate-400"><FileText size={15} aria-hidden="true" /> Source format</span>
            <select aria-label="Input MIME type" className="max-w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200" value={form.inputMimeType} disabled={disabled} onChange={(event) => onChange({ inputMimeType: event.target.value })}>
              <option value="article/url">Article / web page</option><option value="application/pdf">PDF document</option><option value="video/mp4">Video / YouTube</option><option value="audio/mpeg">Audio recording</option><option value="text/plain">Plain text</option><option value="application/vnd.openxmlformats-officedocument.presentationml.presentation">PowerPoint presentation</option><option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word document</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <label className="field-label" htmlFor="source-text">Your source material</label>
          <textarea ref={textRef} id="source-text" disabled={disabled} maxLength={MAX_TEXT_CHARACTERS} value={form.sourceText} onChange={(event) => onChange({ sourceText: event.target.value })} className="field-input min-h-48 resize-y leading-6" placeholder="Paste meeting notes, a policy document, research findings, or a content brief…" aria-describedby="text-help" />
          <div className="mt-2 flex items-start justify-between gap-4 text-xs text-slate-400"><p id="text-help" className="max-w-md leading-5">Supply the facts you want transformed. A prompt creates content from your brief; it does not browse for new research.</p><span className="shrink-0 tabular-nums">{form.sourceText.length.toLocaleString()} / 200k</span></div>
        </div>
      )}
      <div className="mt-5 flex items-center gap-2 border-t border-slate-800/80 pt-4 text-xs text-slate-500"><ArrowUpRight size={14} aria-hidden="true" />PDF · DOCX · PPTX · Video · Audio · Text</div>
    </section>
  );
}
