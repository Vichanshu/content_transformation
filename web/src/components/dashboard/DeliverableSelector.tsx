"use client";
import { Check, Plus } from "lucide-react";
import type { OutputType } from "@/types";
import { DELIVERABLES } from "./catalog";

interface Props { selected: OutputType[]; onChange: (selected: OutputType[]) => void; disabled: boolean }
export default function DeliverableSelector({ selected, onChange, disabled }: Props): React.JSX.Element {
  return <section className="panel" aria-labelledby="deliverable-heading">
    <div className="section-heading"><span className="section-number">02</span><div className="min-w-0 flex-1"><h2 id="deliverable-heading">Choose your deliverables</h2><p>Select the formats your story needs.</p></div><span className="count-badge">{selected.length} selected</span></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {DELIVERABLES.map(({ type, title, description, icon: Icon, tag }) => {
        const active = selected.includes(type);
        return <button key={type} type="button" disabled={disabled} aria-pressed={active} onClick={() => onChange(active ? selected.filter((item) => item !== type) : [...selected, type])} className={`deliverable-card group ${active ? "deliverable-card-selected" : ""}`}>
          <div className="flex items-center justify-between"><span className={`icon-tile ${active ? "text-indigo-300" : "text-slate-400"}`}><Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span><span className={`selection-mark ${active ? "selection-mark-active" : ""}`}>{active ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}</span></div>
          <span className="mt-4 block text-sm font-medium text-slate-100">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span><span className="mt-4 block text-[9px] font-semibold tracking-[0.16em] text-slate-500">{tag}</span>
        </button>;
      })}
    </div>
  </section>;
}
