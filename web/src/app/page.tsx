import {
  ArrowRight,
  AudioLines,
  CircleDashed,
  FileText,
  Layers3,
  RadioTower,
  Sparkles,
  Video
} from "lucide-react";

const inputs = [
  { label: "Documents", detail: "PDF, PPTX, DOCX", icon: FileText },
  { label: "Video", detail: "Footage and recordings", icon: Video },
  { label: "Audio", detail: "Interviews and podcasts", icon: AudioLines },
  { label: "Text", detail: "Notes and source copy", icon: Layers3 }
] as const;

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-8 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 text-accent">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide">Content Transformation Engine</p>
              <p className="text-xs text-muted">Workspace / Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted">
            <RadioTower size={14} className="text-accent" aria-hidden="true" />
            System scaffold ready
          </div>
        </header>

        <section className="grid gap-8 py-16 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Multimodal workspace
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Multimodal Content <span className="text-accent">Transformation Engine</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted">
              A foundation for turning documents, recordings, and raw ideas into
              coordinated content deliverables. Ingestion and job submission arrive
              in the next implementation phase.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Pipeline</p>
            <div className="mt-5 flex items-center gap-3 text-sm">
              <span className="rounded-lg bg-white/5 px-3 py-2">Ingest</span>
              <ArrowRight size={16} className="text-muted" aria-hidden="true" />
              <span className="rounded-lg bg-white/5 px-3 py-2">Route</span>
              <ArrowRight size={16} className="text-muted" aria-hidden="true" />
              <span className="rounded-lg bg-white/5 px-3 py-2">Create</span>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              Durable Inngest checkpoints are registered. Processing stages are
              scaffolded for implementation.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="sources-title" className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">01 / Sources</p>
                <h2 id="sources-title" className="mt-3 text-2xl font-semibold">Input workspace</h2>
                <p className="mt-2 text-sm text-muted">Choose a source type when ingestion is enabled.</p>
              </div>
              <CircleDashed size={22} className="text-muted" aria-hidden="true" />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {inputs.map(({ label, detail, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-dashed border-border bg-background/60 p-5">
                  <Icon size={22} className="text-accent" aria-hidden="true" />
                  <h3 className="mt-5 text-sm font-medium">{label}</h3>
                  <p className="mt-1 text-xs text-muted">{detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="queue-title" className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">02 / Activity</p>
            <h2 id="queue-title" className="mt-3 text-2xl font-semibold">Job queue</h2>
            <p className="mt-2 text-sm text-muted">Submitted transformations will appear here.</p>
            <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 px-6 text-center">
              <CircleDashed size={28} className="text-accent" aria-hidden="true" />
              <p className="mt-4 text-sm font-medium">No jobs yet</p>
              <p className="mt-2 max-w-xs text-xs leading-5 text-muted">
                This queue is a placeholder until ingestion and persistence are connected.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
