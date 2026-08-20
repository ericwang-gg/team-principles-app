import { useState } from "react";
import type { SessionAction, SessionState, Topic } from "../session";

type TopicSynthesisProps = {
  state: SessionState;
  isFacilitator: boolean;
  sendAction: (action: SessionAction) => void;
  onContinue: () => void;
};

function genTopicId() {
  return "topic-" + Math.random().toString(36).slice(2, 9);
}

export function TopicSynthesis({ state, isFacilitator, sendAction, onContinue }: TopicSynthesisProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");

  function addTopic() {
    const label = labelInput.trim();
    const description = descriptionInput.trim();
    if (!label || !description) return;
    const topic: Topic = { id: genTopicId(), label, description };
    sendAction({ kind: "addTopic", topic });
    setLabelInput("");
    setDescriptionInput("");
    setIsAdding(false);
  }

  function removeTopic(topicId: string) {
    sendAction({ kind: "removeTopic", topicId });
  }

  return (
    <div className="center-column wide-column">
      <span className="eyebrow">What's emerging</span>
      <h2 className="question-title">Topics on the table</h2>
      <p className="subhead">Next, everyone picks the 2-3 topics that matter most to them.</p>

      <div className="topic-grid">
        {(state.topics ?? []).map((t) => (
          <div className="topic-card" key={t.id}>
            {isFacilitator && (
              <button
                type="button"
                className="delete-x topic-card-remove"
                onClick={() => removeTopic(t.id)}
                aria-label="Remove topic"
              >
                ×
              </button>
            )}
            <strong>{t.label}</strong>
            <p>{t.description}</p>
          </div>
        ))}
      </div>

      {isFacilitator && (
        <div className="answer-card">
          {isAdding ? (
            <>
              <input
                className="pill-input"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Topic label"
                autoFocus
              />
              <textarea
                className="topic-comment"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Short description"
                rows={2}
              />
              <div className="poster-actions">
                <button className="btn btn--outline" onClick={() => setIsAdding(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={addTopic}
                  disabled={!labelInput.trim() || !descriptionInput.trim()}
                >
                  Add topic
                </button>
              </div>
            </>
          ) : (
            <button className="btn btn--outline" onClick={() => setIsAdding(true)}>
              + Add a topic
            </button>
          )}
        </div>
      )}

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
