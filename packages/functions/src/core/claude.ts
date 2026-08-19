import Anthropic from "@anthropic-ai/sdk";
import type {
  DraftPrinciplesInput,
  Principle,
  RevisePrinciplesInput,
  SynthesizeTopicsInput,
  Topic,
} from "./types.js";

// Ported verbatim from the design prototype (Team Principles.dc.html) so the
// tone/behavior of Claude's output matches what was designed and reviewed.
const SYSTEM_PROMPT =
  "You are helping a product team (product managers and designers) at GetGo, a Singapore car-sharing platform, turn their own words into team working principles. Write in GetGo's brand voice: friendly, direct, conversational, contractions, sentence case, no corporate jargon, no emoji. Ground every principle in what the team actually said — do not invent generic startup values like 'move fast' or 'customer obsession' unless the team's own words point there. Respond with ONLY valid JSON matching the requested schema. No markdown code fences, no commentary, no extra keys.";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

let idCounter = 0;
function genId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key."
    );
  }
  // Shorter than the frontend's request timeout (api.ts) so a stuck call
  // surfaces as a real server error instead of a client-side abort, and
  // stays under API Gateway's hard 29s integration timeout once deployed.
  return new Anthropic({ apiKey, timeout: 20_000 });
}

function parseJson(text: string): any {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1];
  return JSON.parse(t);
}

async function complete(prompt: string, maxTokens: number): Promise<any> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) throw new Error("Claude response had no text content");
  return parseJson(block.text);
}

export async function synthesizeTopics(input: SynthesizeTopicsInput): Promise<Topic[]> {
  const numTopics = input.numTopics ?? 9;
  const lines = input.participants
    .map(
      (p) =>
        `${p.name}:\n` +
        input.questions
          .map((q) => `- ${q.text} → ${input.answers[q.key]?.[p.id] || "(no answer)"}`)
          .join("\n")
    )
    .join("\n\n");

  const prompt =
    "Here's what the team said about how they want to work together. Each person answered 5 open-ended questions, in their own words.\n\n" +
    lines +
    `\n\nFrom this raw material, identify exactly ${numTopics} topics — recurring themes or tensions that seem to matter to this team (not final principles yet, just the underlying threads you notice, grounded in specifics, not generic values-speak). For each: a short label (2-5 words) and a 1-sentence description grounded in what people actually said.\n\nRespond as JSON: {"topics":[{"label":"...","description":"..."}]}`;

  const data = await complete(prompt, 1800);
  if (!data?.topics) throw new Error("Claude response was missing `topics`");
  // Defensive cap — trust the prompt, but don't rely on Claude counting exactly.
  return data.topics
    .slice(0, numTopics)
    .map((t: any) => ({ id: genId("topic"), label: t.label, description: t.description }));
}

export async function draftPrinciples(input: DraftPrinciplesInput): Promise<Principle[]> {
  const numPrinciples = input.numPrinciples ?? 6;
  const topicsText = input.topics
    .map((t) => {
      const count = input.pickCounts[t.id] || 0;
      const comments = input.commentsByTopic[t.id] || [];
      return (
        `${t.label} — picked by ${count} of ${input.participantCount} — ${t.description}` +
        (comments.length ? `\n  Comments: ${comments.join(" / ")}` : "")
      );
    })
    .join("\n\n");

  const prompt =
    "Here are the topics the team surfaced, how many people picked each as mattering most to them, and any comments they left:\n\n" +
    topicsText +
    `\n\nDraft ${numPrinciples} final team working principles. Favor topics picked by more people, but use judgment — merge overlapping ideas and use the comments to sharpen the wording. Each principle: a short punchy title (a handful of words) and a 1-2 sentence body, grounded in what the team actually said, in a friendly, direct, non-corporate voice.\n\nRespond as JSON: {\"principles\":[{\"title\":\"...\",\"body\":\"...\"}]}`;

  const data = await complete(prompt, 1500);
  if (!data?.principles) throw new Error("Claude response was missing `principles`");
  return data.principles.map((p: any) => ({ id: genId("principle"), title: p.title, body: p.body }));
}

export async function revisePrinciples(input: RevisePrinciplesInput): Promise<Principle[]> {
  const lines = input.principles
    .map((p, i) => {
      const cs = input.commentsByPrincipleId[p.id] || [];
      return (
        `${i + 1}. ${p.title} — ${p.body}` +
        (cs.length
          ? `\n   Comments: ${cs.map((c) => `${c.name}: "${c.text}"`).join(" | ")}`
          : "\n   Comments: none")
      );
    })
    .join("\n\n");

  const prompt =
    "Here are our current team principles and the comments the team left on each:\n\n" +
    lines +
    `\n\nRevise the principles to address the comments — keep the same number of principles (${input.principles.length}), keep what's working, sharpen what people flagged. Friendly, direct, non-corporate voice. Respond as JSON: {"principles":[{"title":"...","body":"..."}]}`;

  const data = await complete(prompt, 1500);
  if (!data?.principles) throw new Error("Claude response was missing `principles`");
  return data.principles.map((p: any) => ({ id: genId("principle"), title: p.title, body: p.body }));
}
