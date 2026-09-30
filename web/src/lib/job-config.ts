export const GENERATION_CHOICES = {
  audience: ["Executive Leadership", "Technical / Engineering", "General Public", "Domain Specialists / Analysts", "Sales & Marketing"],
  tone: ["Authoritative & Objective", "Conversational & Engaging", "Urgent / Advisory", "Analytical & Technical", "Inspirational"],
  language: ["English (US)", "English (UK)", "Spanish", "French", "German", "Japanese"],
  detail: ["Concise Briefing", "Balanced Overview", "Deep Dive / Exhaustive"],
  objective: ["Inform & Educate", "Drive Engagement & Discussion", "Risk Alert & Mitigation", "Strategic Decision Support"],
  style: ["Data-Dense & Analytical", "Narrative / Storytelling", "Action-Oriented / Bulleted"]
} as const;

export type GenerationOptions = {
  [K in keyof typeof GENERATION_CHOICES]: (typeof GENERATION_CHOICES)[K][number];
};

export const DEFAULT_OPTIONS: GenerationOptions = {
  audience: "Executive Leadership",
  tone: "Authoritative & Objective",
  language: "English (US)",
  detail: "Balanced Overview",
  objective: "Inform & Educate",
  style: "Data-Dense & Analytical"
};

export const OUTPUT_TYPES = ["video_script", "storyboard", "linkedin_post", "tweet_thread", "strategic_advisory", "slide_deck", "executive_summary", "infographic"] as const;
export const MAX_TEXT_CHARACTERS = 200_000;

export function parseGenerationOptions(value: unknown): GenerationOptions {
  if (value === undefined || value === null) return { ...DEFAULT_OPTIONS };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Generation options must be an object");
  }
  const record = value as Record<string, unknown>;
  const result: Record<string, string> = { ...DEFAULT_OPTIONS };
  for (const [key, choices] of Object.entries(GENERATION_CHOICES)) {
    const option = record[key];
    if (option === undefined) continue;
    if (typeof option !== "string" || !(choices as readonly string[]).includes(option)) {
      throw new Error(`Choose a supported ${key} option`);
    }
    result[key] = option;
  }
  return result as GenerationOptions;
}
