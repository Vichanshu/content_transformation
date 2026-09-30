# Content Transformation Engine

This implementation follows the pipeline architecture below: dual-track extraction, context normalization, AI complexity routing, a single-agent or multi-agent generation path, and validated final output.

```text
Next.js Dashboard -> Inngest Orchestrator -> Dual-Track Extraction
                                               |-> Docling: PDF / DOCX / PPTX
                                               |-> FFmpeg + Gemini: video / audio
                                               v
                                        Context Normalizer
                                               v
                                        Gemini Complexity Router
                                    score <= 7 | score >= 8
                                  Single Agent | Multi-Agent (MoA)
                                               v
                                      Final Output Engine
```

## Free model and API choices

| Architecture role | Implementation | Cost model |
| --- | --- | --- |
| Complexity router | Gemini 2.5 Flash-Lite | Gemini API free tier |
| Single-agent generation | Gemini 2.5 Flash-Lite | Gemini API free tier |
| MoA specialists, critic, aggregator | Gemini 2.5 Flash-Lite | Gemini API free tier |
| Media transcription | Gemini 2.5 Flash-Lite through the Gemini Files API | Gemini API free tier |
| PDF, DOCX, PPTX extraction | Docling running locally | Open source |
| Video/audio preparation | FFmpeg running locally | Open source |
| Orchestration | Local Inngest development server | Local development |
| Jobs, drafts, logs, and outputs | Neon Postgres | Neon free tier |

There are no OpenAI, Anthropic, LiteLLM, Deepgram, AWS, NVIDIA, CUDA, or paid transcription dependencies. Gemini free-tier limits still apply. Gemini 2.5 Flash-Lite accepts text, video, and audio input on the free tier; configure another Gemini model in `.env` only if it is available to your account.

## Run locally

1. Link the repository to a Neon branch. This writes the pooled `DATABASE_URL` and migration-only `DATABASE_URL_UNPOOLED` into `.env`.

   ```bash
   neon link --project-id small-grass-61556484 --branch production -y
   ```

2. Set `GEMINI_API_KEY` in `.env`. Keep `GEMINI_MODEL` and `GEMINI_MEDIA_MODEL` set to `gemini-2.5-flash-lite` unless you need a different Gemini model.

3. Start the stack:

   ```bash
   docker compose up --build
   ```

4. Open the dashboard at [http://localhost:3000](http://localhost:3000). Inspect workflows at [http://localhost:8288](http://localhost:8288).

The first worker build takes longer because Docling is installed for document extraction. It uses CPU dependencies only: this Compose configuration contains no GPU device, NVIDIA runtime, CUDA image, or NVIDIA package.

## Services

| Service | Responsibility | Host port |
| --- | --- | --- |
| `web` | Dashboard, job API, Gemini routing and generation, output formatting | 3000 |
| `inngest` | Durable local orchestration, async steps, retries | 8288 |
| `worker` | Docling documents, FFmpeg media preparation, Gemini transcription, normalization | Internal only |
| Neon Postgres | Jobs, drafts, logs, and validated outputs | Managed remotely |

## Inputs and outputs

Input sources must be public HTTPS URLs or pasted text. Supported URL types are HTML/text, PDF, DOCX, PPTX, MP4, MOV, MP3, WAV, and YouTube videos with available captions.

Supported output types are video scripts, storyboards, LinkedIn posts, social threads, strategic advisories, slide specifications, executive summaries, and infographic specifications.

## Configuration

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Required Gemini API key. |
| `GEMINI_MODEL` | Router, single-agent, specialist, critic, and aggregator model. |
| `GEMINI_MEDIA_MODEL` | Gemini model used for video/audio transcription. |
| `DATABASE_URL` | Neon pooled connection used by the application. |
| `DATABASE_URL_UNPOOLED` | Neon direct connection used only for Prisma migrations. |
| `DOCLING_TIMEOUT_SECONDS` | Time limit for document extraction. |
| `FFMPEG_TIMEOUT_SECONDS` | Time limit for media audio preparation. |
| `MAX_SOURCE_BYTES`, `SOURCE_TIMEOUT_SECONDS` | Download limits for remote inputs. |
