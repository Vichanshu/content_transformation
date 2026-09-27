# Content Transformation Engine

An event-driven foundation for a SaaS that converts PDFs, presentations, documents, video, audio, and text into channel-specific deliverables. Milestone 2 implements URL/S3 extraction for PDF, PPTX, DOCX, MP4, MOV, MP3, and WAV inputs. Milestone 3 adds LiteLLM complexity routing and durable single-agent or multi-agent draft generation. Final delivery, authentication, and billing remain future work.

## System architecture blueprint

```text
 Browser / client
      │ source URLs, output requests (future ingestion API)
      ▼
 Next.js web + orchestrator gateway ───────────────► PostgreSQL 16
      │  App Router UI, Prisma                         jobs + logs
      │
      └──► Inngest event: engine/job.submitted
                 │
                 ▼
          processTransformationJob
          ├─ step.run: extraction + normalization ───► FastAPI worker :8000
          │                                             ├─ Docling: PDF/PPTX/DOCX
          │                                             └─ FFmpeg + Deepgram: audio/transcripts
          ├─ step.run: complexity routing
          ├─ step.run: content generation ────────────► LiteLLM proxy (external)
          ├─ step.run: draft storage ──────────────────► PostgreSQL
          └─ final delivery / object storage (future)
```

The web service owns orchestration and durable job state. The worker owns expensive parsing and media operations. Inngest retries each extraction or generation checkpoint up to three times and records a terminal failure when retries are exhausted. LiteLLM is an **external gateway**, configured by URL; it is not a fourth Compose service. Jobs move through `ROUTING` to `GENERATING` and retain their drafts there until final delivery is implemented.

## Stack and rationale

| Layer | Technology | Reason |
| --- | --- | --- |
| Web/UI | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui configuration, Lucide | Typed server/client boundaries and a component-ready UI foundation. |
| Workflow | Inngest | Event triggers and durable `step.run` checkpoints for long-running jobs. |
| State | PostgreSQL 16, Prisma | Relational job and log state with JSON fields for variable source/output payloads. |
| Extraction | FastAPI, Pydantic v2, Docling, FFmpeg | Separate Python runtime for document intelligence and media processing. |
| AI gateway | LiteLLM proxy, Axios client | Central model routing boundary; model policies can evolve without changing the workflow contract. |
| Development | Docker Compose | Repeatable three-service startup, health checks, and persistent database volume. |

## Local development

**Prerequisites:** Docker Engine with Compose v2, Node.js 20.9+ and npm for host-side web development, Python 3.11 for host-side worker development, and an Inngest Dev Server. Docling has substantial model and system dependencies, so the first worker image build can take time and space.

1. From the repository root, create the local environment file: `cp .env.example .env`. Replace the sample PostgreSQL password in both `POSTGRES_PASSWORD` and `DATABASE_URL` with the same value. Keep `.env` private.
2. Start the three services: `docker compose up --build -d`. The web UI is at `http://localhost:3000`, worker docs at `http://localhost:8000/docs`, and PostgreSQL at `localhost:5432`. The web and worker containers mount their source directories for development reloads.
3. Apply the committed migrations once the database is healthy: `docker compose exec web npx prisma migrate deploy`. To create another migration during development, run `docker compose exec web npx prisma migrate dev --name <change_name>`. If this database was previously initialized with `prisma db push`, use a fresh disposable local volume or baseline the existing database before applying migration history.
4. Start the Inngest Dev Server on the host and register `http://localhost:3000/api/inngest`, for example: `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`. Its UI defaults to `http://localhost:8288`. The container's `INNGEST_DEV_SERVER_URL` uses `host.docker.internal:8288`; Compose maps it to the SDK's `INNGEST_DEV` setting and supplies the host gateway mapping for Linux. Event and signing keys can remain blank for local development, but must be configured for hosted Inngest.
5. Check service health: `curl http://localhost:8000/health` should return `{"status":"healthy","service":"worker"}`. Visiting the web UI should show the scaffold workspace.

For host-side development, install web dependencies with `cd web && npm install && npm run db:generate && npm run dev`. In a separate terminal, use `cd worker && python3.11 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`. A host-run web process needs `DATABASE_URL` with `localhost:5432`, `WORKER_INTERNAL_URL=http://localhost:8000`, and `INNGEST_DEV=http://localhost:8288`; the values in `.env.example` use Docker network hostnames. Source these overrides in your shell or a local, ignored `web/.env.local` file. Do not start host and Compose copies of the same service on the same port.

The worker accepts only HTTPS or `s3://` sources, caps downloads at `MAX_SOURCE_BYTES`, and cleans scratch files after each request. S3 access uses the standard AWS credential chain. For media, configure `DEEPGRAM_API_KEY`; absent credentials return HTTP 503 rather than a fabricated transcript. The UI is static and job submission remains a future phase; create a Job record and send `engine/job.submitted` with its `jobId` through Inngest to exercise orchestration.

For generation, point `LITELLM_PROXY_URL` at the proxy root (for example `http://host.docker.internal:4000`) and configure the four model names as LiteLLM model aliases. The gateway calls `/v1/chat/completions`. Complexity scores of 0–7 use one generator; scores of 8–10 run Writer, Tone and Accuracy Critic, and Audience Strategist checkpoints in parallel, then a judge synthesizes their contributions. Extraction and specialist steps persist full content in PostgreSQL and return only small metadata to Inngest. Generation prompts have a 40,000-character source budget that prioritizes metadata, headings, tables, and chronological excerpts. `Job.generationMetadata.truncated` records whether compression occurred, while `GenerationDraft` stores intermediate specialist and aggregate outputs. The judge receives a concise source evidence anchor. The workflow also stores `complexityScore`, `selectedTier`, and `draftDeliverables`; it does not mark the job `COMPLETED`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT`, `NEXT_PUBLIC_APP_URL` | Web runtime mode, internal listener port, public browser URL. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compose PostgreSQL initialization; keep the password aligned with `DATABASE_URL`. |
| `DATABASE_URL` | Prisma PostgreSQL connection string; use `postgres` inside Compose and `localhost` on the host. |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Hosted Inngest event sending and webhook verification credentials. |
| `INNGEST_DEV_SERVER_URL` | Dev Server URL from inside the web container; Compose passes it as `INNGEST_DEV` to the SDK. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Provider credentials reserved for model routing. Prefer configuring them on the LiteLLM gateway when possible. |
| `DEEPGRAM_API_KEY` | Required for Deepgram media transcription. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` | Optional S3 credentials and region; IAM roles can supply credentials instead. |
| `LITELLM_PROXY_URL`, `LITELLM_API_KEY` | External LiteLLM base URL and optional proxy bearer key. |
| `LITELLM_ROUTER_MODEL`, `LITELLM_SINGLE_MODEL` | Model aliases for complexity scoring and single-agent generation. |
| `LITELLM_SPECIALIST_MODEL`, `LITELLM_JUDGE_MODEL` | Model aliases for parallel specialists and MoA synthesis. |
| `WORKER_INTERNAL_URL` | Worker URL from the web container (`http://worker:8000`). |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed by FastAPI. |
| `MAX_SOURCE_BYTES`, `SOURCE_TIMEOUT_SECONDS` | Download size cap and HTTP request timeout. |
| `DOCLING_TIMEOUT_SECONDS`, `FFMPEG_TIMEOUT_SECONDS`, `DEEPGRAM_TIMEOUT_SECONDS` | Document conversion, media conversion, and transcription timeouts. |

## Monorepo roadmap

1. **Phase 1 — Foundation:** Service images, data schema, health checks, typed payloads, Inngest registration, and UI shell are established.
2. **Phase 2 — Ingestion and extraction:** Docling parsing, FFmpeg audio preparation, Deepgram diarization, and normalized context persistence are implemented. Authenticated upload, object storage provisioning, and scene keyframes remain.
3. **Phase 3 — Routing and generation:** Complexity scoring, STANDARD/PREMIUM selection, LiteLLM calls, parallel MoA specialists, and draft persistence are implemented. Citation checks and artifact validation remain.
4. **Phase 4 — Product hardening:** Add job submission and queue UI, tenant isolation, access control, metering, observability, retry/dead-letter policy, retention controls, migrations, and CI/CD.

## Repository map

`web/src/app` contains the UI and Inngest HTTP route. `web/src/inngest` contains the client and durable workflow. `web/prisma` defines persisted jobs, logs, and generation drafts. `worker/app/schemas` defines request/response contracts, and `worker/app/services` contains source download, Docling, and media extraction. The `web/src/components/ui` directory is ready for generated shadcn/ui components.

## Milestone 2 verification commands

```bash
cp .env.example .env
docker compose up --build -d
docker compose exec web npx prisma migrate deploy
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/extract/document \
  -H 'Content-Type: application/json' \
  -d '{"job_id":"verify-doc","source_url":"https://example.com/report.pdf"}'
curl -X POST http://localhost:8000/api/extract/media \
  -H 'Content-Type: application/json' \
  -d '{"job_id":"verify-media","source_url":"https://example.com/interview.mp3"}'
curl -X POST http://localhost:8000/api/extract/auto \
  -H 'Content-Type: application/json' \
  -d '{"job_id":"verify-auto","source_url":"https://example.com/slides.pptx"}'
```

Replace the example URLs with real files you control. The media command needs a valid Deepgram key. Uploaded or presigned links must remain reachable for the duration of extraction.
