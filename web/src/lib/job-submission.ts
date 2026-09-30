import { MAX_TEXT_CHARACTERS, OUTPUT_TYPES, parseGenerationOptions } from "@/lib/job-config";
import type { JobSubmissionPayload, OutputType } from "@/types";

export function parseSubmission(value: unknown): JobSubmissionPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Provide a JSON request object");
  const body = value as Record<string, unknown>;
  const { sourceUrls, sourceText, inputMimeType, outputTypes, tier } = body;
  const hasText = typeof sourceText === "string" && sourceText.trim().length > 0;
  if (!Array.isArray(sourceUrls) || sourceUrls.length > 1) throw new Error("Provide one source URL, or paste text instead");
  if (hasText) {
    if (sourceUrls.length > 0) throw new Error("Choose a URL or raw text, not both");
    if ((sourceText as string).length > MAX_TEXT_CHARACTERS) throw new Error("Text must be 200,000 characters or fewer");
    if (inputMimeType !== "text/plain") throw new Error("Inline text must use text/plain");
  } else {
    if (sourceUrls.length === 0 && typeof sourceText === "string") throw new Error("Paste source text before submitting");
    if (sourceUrls.length !== 1 || typeof sourceUrls[0] !== "string" || sourceUrls[0].length > 2048) throw new Error("Add a valid source URL before submitting");
    try {
      const url = new URL(sourceUrls[0]);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error();
    } catch { throw new Error("Use a public HTTPS URL without embedded credentials"); }
  }
  if (sourceText !== undefined && typeof sourceText !== "string") throw new Error("Source text must be a string");
  if (typeof inputMimeType !== "string" || inputMimeType.length > 255 || !/^[\w.+-]+\/[\w.+-]+$/.test(inputMimeType)) throw new Error("Choose a valid source format");
  if (!Array.isArray(outputTypes) || outputTypes.length === 0 || outputTypes.length > OUTPUT_TYPES.length || !outputTypes.every((type): type is OutputType => typeof type === "string" && (OUTPUT_TYPES as readonly string[]).includes(type)) || new Set(outputTypes).size !== outputTypes.length) throw new Error("Select at least one supported deliverable, without duplicates");
  if (tier !== undefined && tier !== "STANDARD" && tier !== "PREMIUM") throw new Error("Choose STANDARD or PREMIUM processing");
  return {
    sourceUrls: hasText ? [] : [sourceUrls[0] as string],
    ...(hasText ? { sourceText: (sourceText as string).trim() } : {}),
    inputMimeType,
    outputTypes,
    ...(tier ? { tier } : {}),
    options: parseGenerationOptions(body.options)
  };
}
