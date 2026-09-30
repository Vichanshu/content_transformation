import { Clapperboard, FileText, Linkedin, MessageCircle, MonitorPlay, ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import type { OutputType } from "@/types";

export const DELIVERABLES = [
  { type: "video_script", title: "Video package", description: "Script, storyboard & scene direction", icon: Clapperboard, tag: "VIDEO" },
  { type: "linkedin_post", title: "LinkedIn post", description: "A strong hook. A clear point of view.", icon: Linkedin, tag: "SOCIAL" },
  { type: "tweet_thread", title: "X / Twitter thread", description: "Your story, one post at a time", icon: MessageCircle, tag: "SOCIAL" },
  { type: "strategic_advisory", title: "Strategic advisory", description: "Risks, recommendations & next steps", icon: ShieldCheck, tag: "STRATEGY" },
  { type: "infographic", title: "Infographic spec", description: "Key figures, callouts & layout direction", icon: ChartNoAxesCombined, tag: "VISUAL" },
  { type: "executive_summary", title: "Executive summary", description: "The essential insights, distilled", icon: FileText, tag: "BRIEFING" },
  { type: "slide_deck", title: "Presentation deck", description: "Slide-by-slide, with speaker notes", icon: MonitorPlay, tag: "PRESENTATION" }
] as const;

export function outputLabel(type: OutputType): string {
  return type === "storyboard" ? "Storyboard" : DELIVERABLES.find((item) => item.type === type)?.title ?? type;
}
