import type { SessionState } from "../session";

type TopicSynthesisProps = {
  state: SessionState;
  isFacilitator: boolean;
  onContinue: () => void;
};

export function TopicSynthesis({ state, isFacilitator, onContinue }: TopicSynthesisProps) {
  return (
    <div className="center-column wide-column">
      <span className="eyebrow">What's emerging</span>
      <h2 className="question-title">Topics on the table</h2>
      <p className="subhead">Next, everyone picks the 2-3 topics that matter most to them.</p>

      <div className="topic-grid">
        {(state.topics ?? []).map((t) => (
          <div className="topic-card" key={t.id}>
            <strong>{t.label}</strong>
            <p>{t.description}</p>
          </div>
        ))}
      </div>

      {isFacilitator ? (
        <button className="btn btn--primary" onClick={onContinue}>
          Continue to Round 2 →
        </button>
      ) : (
        <p className="subhead">Waiting for the facilitator to continue.</p>
      )}
    </div>
  );
}
