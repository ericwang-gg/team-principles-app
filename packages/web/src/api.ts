// Client for the server-side Claude endpoints (local-dev/api-server.ts
// locally, or the deployed HTTP API once AWS is set up).
import type { Principle, Topic } from "./session";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8788";

// Keeps a stuck request from spinning the loading UI forever — bounded well
// under API Gateway's hard 29s integration timeout for when this deploys.
const REQUEST_TIMEOUT_MS = 25_000;

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export type SynthesizeTopicsInput = {
  participants: { id: string; name: string }[];
  questions: { key: string; text: string }[];
  answers: Record<string, Record<string, string>>;
  numTopics?: number;
};

export type DraftPrinciplesInput = {
  topics: Topic[];
  participantCount: number;
  pickCounts: Record<string, number>;
  commentsByTopic: Record<string, string[]>;
  numPrinciples?: number;
};

export type RevisePrinciplesInput = {
  principles: Principle[];
  commentsByPrincipleId: Record<string, { name: string; text: string }[]>;
};

export function synthesizeTopics(input: SynthesizeTopicsInput) {
  return post<{ topics: Topic[] }>("/topics", input);
}

export function draftPrinciples(input: DraftPrinciplesInput) {
  return post<{ principles: Principle[] }>("/principles", input);
}

export function revisePrinciples(input: RevisePrinciplesInput) {
  return post<{ principles: Principle[] }>("/revise", input);
}
