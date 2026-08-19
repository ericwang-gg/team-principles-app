import { useEffect, useState } from "react";
import { FacilitatorFooter } from "../components/FacilitatorFooter";
import { DEMO_ANSWER } from "../demo";
import type { AnswerRoundState, Participant, Principle, RoundKey } from "../session";

export type QuestionSpec = { key: string; text: string; subtext?: string };

type AnswerRoundProps = {
  roundKey: RoundKey;
  roundLabel: string;
  questions: readonly QuestionSpec[];
  round: AnswerRoundState;
  timerSeconds: number;
  isFacilitator: boolean;
  myId: string;
  demoMode: boolean;
  participants: Participant[];
  waitingHeadline: string;
  nextLabel: string;
  onSubmitAnswer: (promptKey: string, value: string, principleIds?: string[]) => void;
  onReveal: () => void;
  onNext: () => void;
  headerExtra?: React.ReactNode;
  // Only relevant on the round's last question, where "Next" triggers a
  // Claude call (topic synthesis / finalize) instead of just advancing.
  nextLoading?: boolean;
  nextLoadingLabel?: string;
  nextError?: string | null;
  // Round-3-only: lets the answerer highlight which principles guided their
  // answer (multi-select, no cap), shown alongside their answer once revealed.
  principleOptions?: Principle[];
  principleSelections?: Record<string, Record<string, string[]>>; // promptKey -> participantId -> ids
};

// Shared by Round 1 and Round 3 — identical shape per the design spec:
// question -> submit -> waiting, then facilitator reveals everyone's answers
// and advances. The timer is purely visual pressure; it never auto-submits
// or auto-advances.
export function AnswerRound({
  roundKey,
  roundLabel,
  questions,
  round,
  timerSeconds,
  isFacilitator,
  myId,
  demoMode,
  participants,
  waitingHeadline,
  nextLabel,
  onSubmitAnswer,
  onReveal,
  onNext,
  headerExtra,
  nextLoading,
  nextLoadingLabel,
  nextError,
  principleOptions,
  principleSelections,
}: AnswerRoundProps) {
  const question = questions[round.currentIndex];
  const draftKey = `${roundKey}:${question.key}`;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedPrinciples, setSelectedPrinciples] = useState<Record<string, string[]>>({});
  const [seconds, setSeconds] = useState(timerSeconds);

  useEffect(() => {
    setSeconds(timerSeconds);
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [roundKey, round.currentIndex, timerSeconds]);

  const myAnswer = round.answers[question.key]?.[myId];
  const hasAnswered = myAnswer !== undefined;
  const answeredCount = Object.keys(round.answers[question.key] ?? {}).length;
  const draftValue = drafts[draftKey] ?? (demoMode ? DEMO_ANSWER : "");
  const selectedIds =
    selectedPrinciples[draftKey] ??
    (demoMode && principleOptions ? principleOptions.slice(0, 2).map((p) => p.id) : []);

  function togglePrinciple(id: string) {
    setSelectedPrinciples((sel) => {
      const current = sel[draftKey] ?? selectedIds;
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...sel, [draftKey]: next };
    });
  }

  function submit() {
    const value = draftValue.trim();
    if (!value) return;
    onSubmitAnswer(question.key, value, principleOptions ? selectedIds : undefined);
  }

  return (
    <div className="center-column round-column">
      <span className="eyebrow">
        {roundLabel} · Question {round.currentIndex + 1} of {questions.length}
      </span>
      {!round.revealed && <span className="pill timer-chip">⏱ 0:{String(seconds).padStart(2, "0")}</span>}
      {headerExtra}
      <h2 className="question-title">{question.text}</h2>
      {question.subtext && <p className="subhead">{question.subtext}</p>}

      {round.revealed ? (
        <div className="revealed-answers">
          {participants.map((p) => {
            const theirPrincipleIds = principleSelections?.[question.key]?.[p.id] ?? [];
            return (
              <div className="revealed-card" key={p.id}>
                <strong>{p.name}</strong>
                <p>{round.answers[question.key]?.[p.id] ?? "(no answer)"}</p>
                {principleOptions && theirPrincipleIds.length > 0 && (
                  <div className="revealed-principle-chips">
                    {theirPrincipleIds.map((id) => {
                      const principle = principleOptions.find((pr) => pr.id === id);
                      return principle ? (
                        <span className="pill pill--outline pill--wrap" key={id}>
                          {principle.title}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : hasAnswered ? (
        <div className="answer-card">
          <h3>{waitingHeadline}</h3>
          <p className="subhead">Waiting for the rest of the team.</p>
        </div>
      ) : (
        <div className="answer-card">
          {principleOptions && principleOptions.length > 0 && (
            <div className="principle-selector">
              <p className="subhead">
                Which principles are guiding your answer? Pick at least 1 — as many as apply.
              </p>
              <div className="scenario-chips">
                {principleOptions.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`toggle-pill${isSelected ? " toggle-pill--on" : ""}`}
                      onClick={() => togglePrinciple(p.id)}
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <textarea
            className="answer-textarea"
            value={draftValue}
            onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))}
            placeholder="Take your time — a sentence or two is plenty."
            rows={4}
          />
          <button
            className="btn btn--primary"
            onClick={submit}
            disabled={!draftValue.trim() || (!!principleOptions && selectedIds.length === 0)}
          >
            Submit
          </button>
        </div>
      )}

      {isFacilitator ? (
        round.revealed ? (
          <>
            <FacilitatorFooter
              actionLabel={nextLoading ? (nextLoadingLabel ?? "Thinking…") : nextLabel}
              onAction={onNext}
              disabled={nextLoading}
            />
            {nextError && <p className="error-text">{nextError}</p>}
          </>
        ) : (
          <FacilitatorFooter
            countLabel={`${answeredCount} of ${participants.length} answered`}
            actionLabel="Reveal answers →"
            onAction={onReveal}
          />
        )
      ) : round.revealed ? (
        <p className="subhead">Waiting for the facilitator to continue.</p>
      ) : null}
    </div>
  );
}
