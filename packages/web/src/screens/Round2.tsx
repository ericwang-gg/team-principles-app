import { useState } from "react";
import { FacilitatorFooter } from "../components/FacilitatorFooter";
import { DEMO_TOPIC_COMMENTS, DEMO_TOPIC_PICKS } from "../demo";
import { useRotatingMessages } from "../hooks/useRotatingMessages";
import {
  DRAFT_LOADING_MESSAGES,
  MAX_TOPIC_PICKS,
  MIN_TOPIC_PICKS,
  type SessionAction,
  type SessionState,
} from "../session";

type Round2Props = {
  state: SessionState;
  isFacilitator: boolean;
  myId: string;
  myName: string;
  sendAction: (action: SessionAction) => void;
  onDraftPrinciples: () => void;
  draftLoading?: boolean;
  draftError?: string | null;
};

export function Round2({
  state,
  isFacilitator,
  myId,
  myName,
  sendAction,
  onDraftPrinciples,
  draftLoading,
  draftError,
}: Round2Props) {
  const topics = state.topics ?? [];
  const mySubmission = state.round2.submissions[myId];
  const [picks, setPicks] = useState<string[]>(() => (state.demoMode ? [...DEMO_TOPIC_PICKS] : []));
  const [comments, setComments] = useState<Record<string, string>>(() =>
    state.demoMode ? { ...DEMO_TOPIC_COMMENTS } : {}
  );

  function toggle(topicId: string) {
    setPicks((prev) => {
      if (prev.includes(topicId)) return prev.filter((id) => id !== topicId);
      if (prev.length >= MAX_TOPIC_PICKS) return prev;
      return [...prev, topicId];
    });
  }

  const hasEnoughPicks = picks.length >= MIN_TOPIC_PICKS;
  const hasExplanationForEveryPick = picks.every((id) => (comments[id] ?? "").trim());
  const canSubmit = hasEnoughPicks && hasExplanationForEveryPick;

  function submit() {
    if (!canSubmit) return;
    sendAction({ kind: "round2Submit", id: myId, name: myName, data: { picks, comments } });
  }

  const submittedCount = Object.keys(state.round2.submissions).length;
  const draftLoadingLabel = useRotatingMessages(DRAFT_LOADING_MESSAGES, !!draftLoading);
  const revealed = state.round2.revealed;

  function pickCountFor(topicId: string) {
    return Object.values(state.round2.submissions).filter((sub) => sub.picks.includes(topicId)).length;
  }

  const topicsByPopularity = [...topics].sort((a, b) => pickCountFor(b.id) - pickCountFor(a.id));

  return (
    <div className="center-column wide-column">
      {revealed ? (
        <>
          <span className="eyebrow">Round 2 · What the team picked</span>
          <h2 className="question-title">Here's what mattered to the team</h2>
          <p className="subhead">This is what we'll draft the principles from.</p>
        </>
      ) : (
        <>
          <span className="eyebrow">Round 2 · Pick your topics</span>
          <h2 className="question-title">Which ones matter most to you?</h2>
          <p className="subhead">
            Pick {MIN_TOPIC_PICKS} to {MAX_TOPIC_PICKS} and explain why each one matters to you — this is what
            we'll draft the principles from.
          </p>
        </>
      )}

      {revealed ? (
        <div className="revealed-answers">
          {topicsByPopularity.map((t, i) => {
            const pickers = state.participants.filter((p) => state.round2.submissions[p.id]?.picks.includes(t.id));
            const isFirstUnpicked = pickers.length === 0 && (i === 0 || pickCountFor(topicsByPopularity[i - 1].id) > 0);
            return (
              <div key={t.id}>
                {isFirstUnpicked && (
                  <div className="not-picked-divider">
                    <span>Not picked by anyone</span>
                  </div>
                )}
                <div className="revealed-card revealed-topic-card">
                  <div className="revealed-topic-col">
                    <strong>
                      {t.label} — picked by {pickers.length}
                    </strong>
                    <p>{t.description}</p>
                  </div>
                  <div className="revealed-topic-col">
                    {pickers.length > 0 ? (
                      pickers.map((p) => (
                        <p key={p.id}>
                          <strong>{p.name}:</strong> {state.round2.submissions[p.id]?.comments[t.id] || "(no comment)"}
                        </p>
                      ))
                    ) : (
                      <p className="subhead">No one picked this.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : mySubmission ? (
        <div className="answer-card">
          <h3>Thanks, got your picks.</h3>
          <p className="subhead">Waiting for the rest of the team.</p>
        </div>
      ) : (
        <>
          <div className="topic-grid">
            {topics.map((t) => {
              const picked = picks.includes(t.id);
              const disabled = !picked && picks.length >= MAX_TOPIC_PICKS;
              return (
                <div className={`topic-card${picked ? " topic-card--selected" : ""}`} key={t.id}>
                  <strong>{t.label}</strong>
                  <p>{t.description}</p>
                  <button
                    className={`toggle-pill${picked ? " toggle-pill--on" : ""}`}
                    onClick={() => toggle(t.id)}
                    disabled={disabled}
                  >
                    {picked ? "Picked ✓" : "Pick"}
                  </button>
                  {picked && (
                    <>
                      <p className="topic-comment-label">
                        Why this one? <span className="required-asterisk">*</span>
                      </p>
                      <textarea
                        className="topic-comment"
                        value={comments[t.id] ?? ""}
                        onChange={(e) => setComments((c) => ({ ...c, [t.id]: e.target.value }))}
                        placeholder="Explain what this topic means to you…"
                        rows={3}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button className="btn btn--primary" onClick={submit} disabled={!canSubmit}>
            Submit picks
          </button>
          {!hasEnoughPicks ? (
            <p className="subhead">Pick at least {MIN_TOPIC_PICKS} topics to continue.</p>
          ) : (
            !hasExplanationForEveryPick && (
              <p className="subhead">Add a short explanation for each pick before submitting.</p>
            )
          )}
        </>
      )}

      {isFacilitator ? (
        revealed ? (
          <>
            <FacilitatorFooter
              actionLabel={draftLoading ? draftLoadingLabel : "Draft principles →"}
              onAction={onDraftPrinciples}
              disabled={draftLoading}
            />
            {draftError && <p className="error-text">{draftError}</p>}
          </>
        ) : (
          <FacilitatorFooter
            countLabel={`${submittedCount} of ${state.participants.length} submitted`}
            actionLabel="Reveal picks →"
            onAction={() => sendAction({ kind: "revealRound2" })}
          />
        )
      ) : (
        revealed && <p className="subhead">Waiting for the facilitator to continue.</p>
      )}
    </div>
  );
}
