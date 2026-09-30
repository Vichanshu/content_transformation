import type { GenerationOptions } from "@/lib/job-config";

type FormatLanguage = GenerationOptions["language"];

const LABELS: Record<FormatLanguage, {
  advisory: string;
  disclaimer: string;
  disclaimerText: string;
  analysis: string;
  summary: string;
  findings: string;
  nextSteps: string;
  noNextSteps: string;
}> = {
  "English (US)": { advisory: "Strategic Advisory", disclaimer: "Disclaimer", disclaimerText: "This advisory is based on the supplied source material. Verify material facts and obtain appropriate professional review before publication or action.", analysis: "Analysis", summary: "Executive Summary", findings: "Key Findings", nextSteps: "Next Steps", noNextSteps: "No next steps were specified in the draft." },
  "English (UK)": { advisory: "Strategic Advisory", disclaimer: "Disclaimer", disclaimerText: "This advisory is based on the supplied source material. Verify material facts and obtain appropriate professional review before publication or action.", analysis: "Analysis", summary: "Executive Summary", findings: "Key Findings", nextSteps: "Next Steps", noNextSteps: "No next steps were specified in the draft." },
  Spanish: { advisory: "Asesoramiento estratégico", disclaimer: "Aviso", disclaimerText: "Este asesoramiento se basa en el material proporcionado. Verifique los datos importantes y solicite una revisión profesional adecuada antes de publicarlo o tomar decisiones.", analysis: "Análisis", summary: "Resumen ejecutivo", findings: "Hallazgos clave", nextSteps: "Próximos pasos", noNextSteps: "El borrador no especifica próximos pasos." },
  French: { advisory: "Avis stratégique", disclaimer: "Avertissement", disclaimerText: "Cet avis repose sur les sources fournies. Vérifiez les faits importants et faites appel à un professionnel compétent avant toute publication ou décision.", analysis: "Analyse", summary: "Synthèse exécutive", findings: "Principaux constats", nextSteps: "Prochaines étapes", noNextSteps: "Le brouillon ne précise aucune prochaine étape." },
  German: { advisory: "Strategische Empfehlung", disclaimer: "Hinweis", disclaimerText: "Diese Empfehlung basiert auf den bereitgestellten Quellen. Prüfen Sie wesentliche Fakten und holen Sie vor Veröffentlichung oder Umsetzung eine geeignete fachliche Prüfung ein.", analysis: "Analyse", summary: "Management-Zusammenfassung", findings: "Wichtige Erkenntnisse", nextSteps: "Nächste Schritte", noNextSteps: "Im Entwurf wurden keine nächsten Schritte genannt." },
  Japanese: { advisory: "戦略的提言", disclaimer: "免責事項", disclaimerText: "この提言は提供された資料に基づきます。公開または意思決定の前に重要な事実を確認し、必要に応じて専門家の確認を受けてください。", analysis: "分析", summary: "エグゼクティブサマリー", findings: "主な調査結果", nextSteps: "次のステップ", noNextSteps: "草案には次のステップが記載されていません。" }
};

export interface VideoScene {
  timestamp: string;
  visual_prompt: string;
  narration: string;
  duration: number;
}

export interface VideoPackage {
  scenes: VideoScene[];
}

export interface PresentationSlide {
  title: string;
  content_bullets: string[];
  speaker_notes: string;
}

export interface Presentation {
  slides: PresentationSlide[];
}

export interface Infographic {
  layout_recommendation: string;
  key_messages: string[];
  data_callouts: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString);
}

/** Remove a single outer Markdown code fence, including an optional language tag. */
export function stripCodeFence(draft: string): string {
  const text = draft.trim().replace(/^\uFEFF/, "");
  const match = text.match(/^```(?:[\w+-]+)?\s*\n([\s\S]*?)\n```\s*$/);
  return (match?.[1] ?? text).trim();
}

function parseJson(draft: string, label: string): unknown {
  try {
    return JSON.parse(stripCodeFence(draft)) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON, optionally wrapped in a Markdown code fence`);
  }
}

function cleanMarkdown(draft: string): string {
  return stripCodeFence(draft)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseOptionalJson(draft: string): unknown {
  try {
    return JSON.parse(stripCodeFence(draft)) as unknown;
  } catch {
    return draft;
  }
}

function socialText(value: unknown): string | null {
  if (nonEmptyString(value)) return value.trim();
  if (!isRecord(value)) return null;

  const content = [value.content, value.post, value.text, value.body]
    .find(nonEmptyString);
  if (!content) return null;

  const hashtags = stringArray(value.hashtags)
    ? value.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")
    : "";
  return [content.trim(), hashtags].filter(Boolean).join("\n\n");
}

function socialPayload(draft: string, key: "linkedin_post" | "tweet_thread"): unknown {
  const parsed = parseOptionalJson(draft);
  return isRecord(parsed) && key in parsed ? parsed[key] : parsed;
}

function removeLeadingTitle(text: string, title: string): string {
  const lines = text.split("\n");
  if (new RegExp(`^#{0,6}\\s*${title}\\s*$`, "i").test(lines[0].trim())) {
    return lines.slice(1).join("\n").trim();
  }
  return text;
}

function normalizeSubheadings(text: string): string {
  return text.replace(/^(#{1,6})\s+(.+)$/gm, (
    _match,
    hashes: string,
    heading: string
  ) => `${"#".repeat(Math.max(2, Math.min(hashes.length, 4)))} ${heading.trim()}`);
}

export function formatAdvisory(draft: string, language: FormatLanguage = "English (US)"): string {
  const labels = LABELS[language];
  const body = normalizeSubheadings(
    removeLeadingTitle(removeLeadingTitle(cleanMarkdown(draft), labels.advisory), "Strategic Advisory")
  );
  if (!body) throw new Error("Strategic advisory draft is empty");
  const disclaimer = `## ${labels.disclaimer}\n\n${labels.disclaimerText}`;
  const withoutExistingDisclaimer = body.replace(
    new RegExp(`\\n?##\\s+(?:Disclaimer|${labels.disclaimer})(?:\\s|$)[\\s\\S]*$`, "i"),
    ""
  ).trim();
  const sections = /^##\s+/m.test(withoutExistingDisclaimer)
    ? withoutExistingDisclaimer
    : `## ${labels.analysis}\n\n${withoutExistingDisclaimer}`;
  return `# ${labels.advisory}\n\n${sections}\n\n${disclaimer}`;
}

export function formatVideoPackage(draft: string): VideoPackage {
  const value = parseJson(draft, "Video package");
  if (!isRecord(value) || !Array.isArray(value.scenes) || value.scenes.length === 0) {
    throw new Error("Video package requires a non-empty scenes array");
  }
  const scenes = value.scenes.map((scene: unknown, index: number): VideoScene => {
    if (
      !isRecord(scene) ||
      !nonEmptyString(scene.timestamp) ||
      !nonEmptyString(scene.visual_prompt) ||
      !nonEmptyString(scene.narration) ||
      typeof scene.duration !== "number" ||
      !Number.isFinite(scene.duration) ||
      scene.duration <= 0
    ) {
      throw new Error(`Video scene ${index + 1} is missing required fields`);
    }
    return {
      timestamp: scene.timestamp.trim(),
      visual_prompt: scene.visual_prompt.trim(),
      narration: scene.narration.trim(),
      duration: scene.duration
    };
  });
  return { scenes };
}

export function formatSocialPost(
  draft: string,
  platform: "linkedin"
): string;
export function formatSocialPost(
  draft: string,
  platform: "twitter"
): string[];
export function formatSocialPost(
  draft: string,
  platform: "linkedin" | "twitter"
): string | string[] {
  if (platform === "linkedin") {
    const text = socialText(socialPayload(draft, "linkedin_post"));
    if (!text) throw new Error("LinkedIn post draft is empty");
    const withoutTitle = text.replace(/^#{1,6}\s+(?:LinkedIn Post|Post)\s*\n+/i, "");
    return withoutTitle
      .replace(/(^|\s)(#[\w]+)(?=\s*#)/g, "$1$2 ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const payload = socialPayload(draft, "tweet_thread");
  if (Array.isArray(payload) && payload.every(nonEmptyString)) {
    const posts = payload.map((post) => post.trim());
    if (posts.some((post) => post.length > 280)) throw new Error("Twitter/X thread posts must be at most 280 characters");
    return posts;
  }
  const text = socialText(payload);
  if (!text) throw new Error("Twitter/X thread draft is empty");
  const withoutTitle = text.replace(/^#{1,6}\s+(?:Twitter|X|Tweet)\s+Thread\s*\n+/i, "");
  const numbered = withoutTitle.match(/(?:^|\n)\s*(?:\d+\/\d+|\d+\s*[./)])\s+/g);
  const parts = numbered && numbered.length > 1
    ? withoutTitle.split(/(?:^|\n)\s*(?:\d+\/\d+|\d+\s*[./)])\s+/).filter(Boolean)
    : withoutTitle.split(/\n\s*\n/).filter(Boolean);
  const posts = parts.map((part) => part.trim().replace(/\s*\n\s*/g, " "));
  if (posts.length === 0 || posts.some((post) => post.length === 0 || post.length > 280)) {
    throw new Error("Twitter/X thread must contain non-empty posts of at most 280 characters");
  }
  return posts;
}

export function formatPresentation(draft: string): Presentation {
  const value = parseJson(draft, "Presentation");
  if (!isRecord(value) || !Array.isArray(value.slides) || value.slides.length === 0) {
    throw new Error("Presentation requires a non-empty slides array");
  }
  const slides = value.slides.map((slide: unknown, index: number): PresentationSlide => {
    if (
      !isRecord(slide) ||
      !nonEmptyString(slide.title) ||
      !stringArray(slide.content_bullets) ||
      !nonEmptyString(slide.speaker_notes)
    ) {
      throw new Error(`Presentation slide ${index + 1} is missing required fields`);
    }
    return {
      title: slide.title.trim(),
      content_bullets: slide.content_bullets.map((bullet) => bullet.trim()),
      speaker_notes: slide.speaker_notes.trim()
    };
  });
  return { slides };
}

export function formatExecutiveSummary(draft: string, language: FormatLanguage = "English (US)"): string {
  const labels = LABELS[language];
  const body = normalizeSubheadings(
    removeLeadingTitle(removeLeadingTitle(cleanMarkdown(draft), labels.summary), "Executive Summary")
  );
  if (!body) throw new Error("Executive summary draft is empty");
  const findings = new RegExp(`^##\\s+${labels.findings}(?:\\s|$)`, "im").test(body)
    ? body
    : `## ${labels.findings}\n\n${body}`;
  return new RegExp(`^##\\s+${labels.nextSteps}(?:\\s|$)`, "im").test(findings)
    ? `# ${labels.summary}\n\n${findings}`
    : `# ${labels.summary}\n\n${findings}\n\n## ${labels.nextSteps}\n\n${labels.noNextSteps}`;
}

export function formatInfographic(draft: string): Infographic {
  const value = parseJson(draft, "Infographic");
  if (
    !isRecord(value) ||
    !nonEmptyString(value.layout_recommendation) ||
    !stringArray(value.key_messages) ||
    !stringArray(value.data_callouts)
  ) {
    throw new Error("Infographic requires layout_recommendation, key_messages, and data_callouts");
  }
  return {
    layout_recommendation: value.layout_recommendation.trim(),
    key_messages: value.key_messages.map((message) => message.trim()),
    data_callouts: value.data_callouts.map((callout) => callout.trim())
  };
}
