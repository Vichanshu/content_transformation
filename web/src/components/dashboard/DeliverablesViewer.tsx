"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronDown, Copy, Download, FileJson, Linkedin, MessageCircle, Play, Sparkles } from "lucide-react";
import { formatInfographic, formatPresentation, formatSocialPost, formatVideoPackage } from "@/lib/formatters";
import type { OutputType } from "@/types";
import type { PolledJobResult } from "@/types/dashboard";
import { outputLabel } from "./catalog";

function serialize(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";
}
function download(content: string, name: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }): React.JSX.Element {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { setState("idle"); }, [text]);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setState("copied"); }
    catch { setState("failed"); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  }
  return <button type="button" className="secondary-button" onClick={() => void copy()} aria-live="polite">{state === "copied" ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} aria-hidden="true" />}{state === "copied" ? "Copied" : state === "failed" ? "Copy unavailable · try download" : label}</button>;
}

function Preview({ type, value }: { type: OutputType; value: unknown }): React.JSX.Element {
  if (type === "video_script" || type === "storyboard") {
    const video = formatVideoPackage(serialize(value));
    return <div className="space-y-4">{video.scenes.map((scene, index) => <article key={index} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/30"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-3"><span className="flex items-center gap-2 text-xs font-medium text-indigo-300"><Play size={13} aria-hidden="true" />Scene {String(index + 1).padStart(2, "0")}</span><span className="font-mono text-[11px] text-slate-400">{scene.timestamp} · {scene.duration}s</span></div><div className="grid gap-5 p-5 md:grid-cols-2"><div><p className="preview-label">VISUAL DIRECTION</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{scene.visual_prompt}</p></div><div className="md:border-l md:border-slate-800 md:pl-5"><p className="preview-label">NARRATION / AUDIO</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{scene.narration}</p></div></div></article>)}</div>;
  }
  if (type === "slide_deck") {
    const deck = formatPresentation(serialize(value));
    return <div className="grid gap-4 md:grid-cols-2">{deck.slides.map((slide, index) => <article className="rounded-xl border border-slate-800 bg-slate-950/40 p-6" key={index}><p className="preview-label">SLIDE {String(index + 1).padStart(2, "0")}</p><h4 className="mt-3 text-lg font-semibold leading-7 text-white">{slide.title}</h4><ul className="mt-4 list-disc space-y-2 pl-4 text-sm leading-6 text-slate-300">{slide.content_bullets.map((bullet, number) => <li key={number}>{bullet}</li>)}</ul><details className="group mt-5 border-t border-slate-800 pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-xs text-indigo-300">Speaker notes<ChevronDown size={14} className="group-open:rotate-180" /></summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{slide.speaker_notes}</p></details></article>)}</div>;
  }
  if (type === "infographic") {
    const graphic = formatInfographic(serialize(value));
    return <div className="space-y-5"><div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6"><p className="preview-label">LAYOUT DIRECTION</p><p className="mt-3 text-sm leading-7 text-slate-200">{graphic.layout_recommendation}</p></div><div className="grid gap-3 sm:grid-cols-3">{graphic.data_callouts.map((callout, index) => <div key={index} className="rounded-xl border border-slate-800 bg-slate-950/40 p-5"><span className="text-[10px] font-medium text-slate-500">DATA CALLOUT {index + 1}</span><p className="mt-3 text-lg font-semibold text-indigo-200">{callout}</p></div>)}</div><h4 className="text-sm font-medium text-slate-200">Key messages</h4><ul className="space-y-3">{graphic.key_messages.map((message, index) => <li className="flex gap-3 text-sm leading-6 text-slate-300" key={index}><span className="text-indigo-400">{String(index + 1).padStart(2, "0")}</span>{message}</li>)}</ul></div>;
  }
  if (type === "linkedin_post" || type === "tweet_thread") {
    const posts = type === "tweet_thread" ? value : [value];
    if (!Array.isArray(posts) || !posts.every((post) => typeof post === "string")) throw new Error("Unrecognized social format");
    return <div className="mx-auto max-w-2xl space-y-4">{posts.map((post: string, index: number) => <article key={index} className="rounded-xl border border-slate-700/70 bg-[#131a29] p-5 sm:p-7"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300">{type === "linkedin_post" ? <Linkedin size={20} /> : <MessageCircle size={20} />}</span><div><p className="text-sm font-medium text-slate-100">{type === "linkedin_post" ? "LinkedIn" : `Post ${index + 1} of ${posts.length}`}</p><p className="mt-0.5 text-[11px] text-slate-500">Content preview · ready to copy</p></div></div><p className="my-6 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{post}</p><div className="flex items-center justify-between border-t border-slate-700/60 pt-4"><span className="text-[11px] tabular-nums text-slate-500">{Array.from(post).length} characters</span><CopyButton text={post} label="Copy post" /></div></article>)}</div>;
  }
  if (typeof value !== "string") throw new Error("Unrecognized Markdown format");
  return <article className="markdown-preview mx-auto max-w-3xl"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a> }}>{value}</ReactMarkdown></article>;
}

function SafePreview({ type, value }: { type: OutputType; value: unknown }): React.JSX.Element {
  try { return Preview({ type, value }); }
  catch { return <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-6 text-sm leading-6 text-amber-200">This saved output has a format the preview cannot display. Download or copy the original content using the controls above.</div>; }
}

export default function DeliverablesViewer({ job }: { job: PolledJobResult }): React.JSX.Element {
  const outputs = job.outputTypes;
  const [selected, setSelected] = useState<OutputType>(outputs[0] ?? "executive_summary");
  const current = outputs.includes(selected) ? selected : outputs[0];
  const value = current ? job.finalDeliverables?.[current] : undefined;
  const displayValue = current === "linkedin_post"
    ? formatSocialPost(serialize(value), "linkedin")
    : current === "tweet_thread"
      ? formatSocialPost(serialize(value), "twitter")
      : value;
  const raw = serialize(displayValue);
  const markdown = current === "strategic_advisory" || current === "executive_summary";
  const extension = markdown ? "md" : typeof displayValue === "string" || current === "tweet_thread" ? "txt" : "json";
  const exportText = current === "tweet_thread" && Array.isArray(displayValue) ? displayValue.join("\n\n") : raw;
  return <section className="panel !p-0" aria-labelledby="outputs-heading">
    <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8"><div><p className="eyebrow">THE OUTPUT STUDIO</p><h2 id="outputs-heading" className="mt-2 text-2xl font-semibold tracking-tight text-white">One source. Ready for every channel.</h2><p className="mt-2 text-sm text-slate-400">Review your content, make it your own, and take it into the world.</p></div><button type="button" className="secondary-button" onClick={() => download(JSON.stringify(job.finalDeliverables, null, 2), `synthetix-${job.id}.json`, "application/json")}><FileJson size={15} />Export all</button></div>
    <div className="flex gap-1 overflow-x-auto border-y border-slate-800 bg-slate-950/30 px-4 py-2 sm:px-7" role="tablist" aria-label="Generated deliverables">{outputs.map((type, index) => <button key={type} id={`tab-${type}`} type="button" role="tab" aria-selected={current === type} aria-controls={`preview-${type}`} tabIndex={current === type ? 0 : -1} onClick={() => setSelected(type)} onKeyDown={(event) => { const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0; if (delta) { event.preventDefault(); const next = outputs[(index + delta + outputs.length) % outputs.length]; setSelected(next); document.getElementById(`tab-${next}`)?.focus(); } }} className={`shrink-0 rounded-lg px-4 py-3 text-xs font-medium transition ${current === type ? "bg-indigo-500/15 text-indigo-200" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{outputLabel(type)}</button>)}</div>
    {current && <div role="tabpanel" id={`preview-${current}`} aria-labelledby={`tab-${current}`} className="p-6 sm:p-8" tabIndex={0}><div className="mb-7 flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 text-[11px] text-slate-500"><Sparkles size={14} className="text-indigo-400" />Generated from your source</span><div className="flex flex-wrap gap-2"><CopyButton text={exportText} label={markdown ? "Copy raw Markdown" : "Copy content"} /><button type="button" className="secondary-button" onClick={() => download(exportText, `${current}.${extension}`, extension === "json" ? "application/json" : "text/plain;charset=utf-8")}><Download size={14} />Download .{extension}</button></div></div><SafePreview type={current} value={displayValue} /></div>}
  </section>;
}
