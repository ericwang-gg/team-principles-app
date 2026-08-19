// Optional test/demo mode: bypasses the three live Claude calls with fixed
// canned content and pre-fills answer/comment fields, so the full
// multi-screen flow can be clicked through solo (e.g. across several
// browser profiles) without needing real answers typed in or real API
// calls made. Toggle with VITE_DEMO_MODE=true in .env.local.
import { NUM_PRINCIPLES, NUM_TOPICS, type Principle, type Topic } from "./session";

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export const DEMO_ANSWER = "This is placeholder answer text for demo/QA testing.";
export const DEMO_COMMENT = "Demo comment for testing.";

export const DEMO_TOPICS: Topic[] = Array.from({ length: NUM_TOPICS }, (_, i) => ({
  id: `demo-topic-${i + 1}`,
  label: `Demo topic ${i + 1}`,
  description: `Placeholder description for demo topic ${i + 1}, standing in for what Claude would surface from the team's Round 1 answers.`,
}));

// Round 2 seeds with these two already picked, so the facilitator/participant
// only needs to click Submit to move on.
export const DEMO_TOPIC_PICKS = [DEMO_TOPICS[0].id, DEMO_TOPICS[1].id];
export const DEMO_TOPIC_COMMENTS: Record<string, string> = {
  [DEMO_TOPICS[0].id]: DEMO_COMMENT,
  [DEMO_TOPICS[1].id]: DEMO_COMMENT,
};

// Deliberately long title + body text — stress-tests spacing/wrapping/
// overflow on the poster, final-poster, and Round 3 title chips, which real
// Claude-drafted principles (short titles, 1-2 sentence bodies) wouldn't
// normally exercise.
export const DEMO_PRINCIPLES: Principle[] = Array.from({ length: NUM_PRINCIPLES }, (_, i) => ({
  id: `demo-principle-${i + 1}`,
  title: `This is a very long principle title that should test wrapping and overflow behavior ${i + 1}`,
  body: `This is a very long and useful principle that will help make the team much stronger and want to work more closely together for a long time ${i + 1}`,
}));

export function demoRevise(principles: Principle[]): Principle[] {
  return principles.map((p) => ({ ...p, body: `${p.body} (revised)` }));
}
