// Facilitator-authoritative session state: one SessionState lives in the
// facilitator's tab, mutated only by the pure `reducer` below, then broadcast
// wholesale to every participant. Ported from the design prototype's
// `state.session` shape and `applyAction` reducer
// (../../design_handoff_team_principles/Team Principles.dc.html).

export type Phase =
  | "lobby"
  | "round1"
  | "synth1"
  | "round2"
  | "poster"
  | "comments"
  | "round3"
  | "final";

export type ParticipantRole = "facilitator" | "participant";
export type Participant = { id: string; name: string; role: ParticipantRole };

export type Topic = { id: string; label: string; description: string };
export type Principle = { id: string; title: string; body: string };
export type Round2Submission = { picks: string[]; comments: Record<string, string> };
export type PrincipleComment = { name: string; text: string };

export type AnswerRoundState = {
  currentIndex: number;
  revealed: boolean;
  answers: Record<string, Record<string, string>>; // promptKey -> participantId -> text
};

export type SessionState = {
  phase: Phase;
  // Entered by the facilitator during onboarding; shown as the poster's
  // header sub-text.
  teamName: string;
  // Chosen by the facilitator during onboarding — synced so every
  // participant's screens prefill consistently, not just the facilitator's.
  demoMode: boolean;
  participants: Participant[];
  round1: AnswerRoundState;
  topics: Topic[] | null;
  round2: { submissions: Record<string, Round2Submission>; revealed: boolean };
  round3: AnswerRoundState;
  // promptKey -> participantId -> ids of the principles they say guided that
  // answer. Round-3-only; kept separate from AnswerRoundState (shared with
  // round1) rather than added there, since round1 has no principles yet.
  round3PrincipleSelections: Record<string, Record<string, string[]>>;
  principles: Principle[] | null;
  comments: Record<string, PrincipleComment[]>; // principleId -> comments
  revised: boolean;
};

export type RoundKey = "round1" | "round3";

export type SessionAction =
  | { kind: "join"; id: string; name: string }
  | { kind: "leave"; id: string }
  | { kind: "requestState" }
  | {
      kind: "roundAnswer";
      roundKey: RoundKey;
      promptKey: string;
      id: string;
      name: string;
      value: string;
      // Round-3-only: which principles they say guided this answer.
      principleIds?: string[];
    }
  | { kind: "round2Submit"; id: string; name: string; data: Round2Submission }
  | { kind: "revealRound2" }
  | { kind: "commentSubmit"; principleId: string; name: string; text: string }
  | { kind: "startRound1" }
  | { kind: "revealQuestion"; roundKey: RoundKey }
  | { kind: "nextQuestion"; roundKey: RoundKey }
  | { kind: "setTopics"; topics: Topic[] }
  | { kind: "setPhase"; phase: Phase }
  | { kind: "draftPrinciples"; principles: Principle[] }
  | { kind: "revisePrinciples"; principles: Principle[] }
  | { kind: "saveEditedPrinciples"; principles: Principle[] }
  | { kind: "deletePrinciple"; principleId: string }
  | { kind: "deleteComment"; principleId: string; index: number }
  | { kind: "finalize" };

// Ported verbatim from the prototype so wording matches what was designed/reviewed.
export const ROUND1_PROMPTS: readonly { key: string; text: string }[] = [
  { key: "p1", text: "How do we make sure we make good, solid decisions?" },
  { key: "p2", text: "How should we provide feedback to each other?" },
  { key: "p3", text: "How do we want to show accountability for our work and actions?" },
  { key: "p4", text: "How do we make sure our communication is delivered well?" },
  { key: "p5", text: "How do we want to show support and care for each other?" },
];

export const ROUND3_SCENARIOS: readonly { key: string; title: string; prompt: string }[] = [
  {
    key: "s1",
    title:
      "Engineering says a feature will take three times longer than planned, right before a launch deadline.",
    prompt: "What does the team do?",
  },
  {
    key: "s2",
    title: "User research clearly points one way, but the loudest voice in the room wants to go another.",
    prompt: "What do we do?",
  },
  {
    key: "s3",
    title: "Two teammates disagree on a design direction and can't reach consensus.",
    prompt: "How do we decide?",
  },
];

export const ROUND_TIMER_SECONDS: Record<RoundKey, number> = { round1: 45, round3: 30 };
export const NUM_TOPICS = 9;
export const MIN_TOPIC_PICKS = 2;
export const MAX_TOPIC_PICKS = 3;
export const NUM_PRINCIPLES = 6;

// Rotated on a timer while the corresponding Claude call is in flight, so a
// several-second wait shows visible progress instead of a static label.
export const SYNTH_LOADING_MESSAGES = [
  "Reading everyone's answers…",
  "Looking for common threads…",
  "Naming the topics…",
] as const;

export const DRAFT_LOADING_MESSAGES = [
  "Weighing the votes…",
  "Drafting the principles…",
  "Sharpening the wording…",
] as const;

export const REVISE_LOADING_MESSAGES = [
  "Reading the comments…",
  "Revising the principles…",
  "Almost there…",
] as const;

function emptyAnswerRound(): AnswerRoundState {
  return { currentIndex: 0, revealed: false, answers: {} };
}

export function createInitialSession(
  facilitatorId: string,
  facilitatorName: string,
  teamName: string,
  demoMode: boolean
): SessionState {
  return {
    phase: "lobby",
    teamName,
    demoMode,
    participants: [{ id: facilitatorId, name: facilitatorName, role: "facilitator" }],
    round1: emptyAnswerRound(),
    topics: null,
    round2: { submissions: {}, revealed: false },
    round3: emptyAnswerRound(),
    round3PrincipleSelections: {},
    principles: null,
    comments: {},
    revised: false,
  };
}

function ensureParticipant(participants: Participant[], id: string, name: string): Participant[] {
  if (participants.some((p) => p.id === id)) return participants;
  return [...participants, { id, name, role: "participant" }];
}

function updateRound(
  state: SessionState,
  roundKey: RoundKey,
  updater: (round: AnswerRoundState) => AnswerRoundState
): SessionState {
  return { ...state, [roundKey]: updater(state[roundKey]) } as SessionState;
}

// Pure — runs only on the facilitator's tab. Every branch returns a new
// state; the caller (useSession) is responsible for broadcasting it.
export function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.kind) {
    case "join":
      return { ...state, participants: ensureParticipant(state.participants, action.id, action.name) };

    case "leave":
      return { ...state, participants: state.participants.filter((p) => p.id !== action.id) };

    case "requestState":
      // No-op on content — useSession broadcasts current state after every
      // action regardless, which is what lets a late/refreshed participant catch up.
      return state;

    case "roundAnswer": {
      const next = updateRound(
        { ...state, participants: ensureParticipant(state.participants, action.id, action.name) },
        action.roundKey,
        (round) => ({
          ...round,
          answers: {
            ...round.answers,
            [action.promptKey]: { ...round.answers[action.promptKey], [action.id]: action.value },
          },
        })
      );
      if (action.roundKey !== "round3" || !action.principleIds) return next;
      return {
        ...next,
        round3PrincipleSelections: {
          ...next.round3PrincipleSelections,
          [action.promptKey]: {
            ...next.round3PrincipleSelections[action.promptKey],
            [action.id]: action.principleIds,
          },
        },
      };
    }

    case "round2Submit":
      return {
        ...state,
        participants: ensureParticipant(state.participants, action.id, action.name),
        round2: {
          ...state.round2,
          submissions: { ...state.round2.submissions, [action.id]: action.data },
        },
      };

    case "revealRound2":
      return { ...state, round2: { ...state.round2, revealed: true } };

    case "commentSubmit":
      return {
        ...state,
        comments: {
          ...state.comments,
          [action.principleId]: [
            ...(state.comments[action.principleId] ?? []),
            { name: action.name, text: action.text },
          ],
        },
      };

    case "startRound1":
      return { ...state, phase: "round1" };

    case "revealQuestion":
      return updateRound(state, action.roundKey, (round) => ({ ...round, revealed: true }));

    case "nextQuestion":
      return updateRound(state, action.roundKey, (round) => ({
        ...round,
        currentIndex: round.currentIndex + 1,
        revealed: false,
      }));

    case "setTopics":
      return { ...state, topics: action.topics, phase: "synth1" };

    case "setPhase":
      return { ...state, phase: action.phase };

    case "draftPrinciples":
      return { ...state, principles: action.principles, phase: "poster" };

    case "revisePrinciples":
      // Claude mints fresh principle ids on every regeneration, so old
      // `comments` entries are intentionally left orphaned — "new principles
      // start with no comments" per the design spec. Not a bug to "fix".
      return { ...state, principles: action.principles, revised: true };

    case "saveEditedPrinciples":
      // Manual edits reuse existing principle ids (unlike Claude
      // regeneration above), so comments correctly survive here.
      return { ...state, principles: action.principles, revised: true };

    case "deletePrinciple": {
      const { [action.principleId]: _removed, ...remainingComments } = state.comments;
      return {
        ...state,
        principles: (state.principles ?? []).filter((p) => p.id !== action.principleId),
        comments: remainingComments,
        revised: true,
      };
    }

    case "deleteComment": {
      const existing = state.comments[action.principleId] ?? [];
      return {
        ...state,
        comments: {
          ...state.comments,
          [action.principleId]: existing.filter((_, i) => i !== action.index),
        },
      };
    }

    case "finalize":
      return { ...state, phase: "final" };
  }
}
