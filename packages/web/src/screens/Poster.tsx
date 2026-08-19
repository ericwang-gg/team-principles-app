import { useRef, useState } from "react";
import { DEMO_COMMENT } from "../demo";
import { useRotatingMessages } from "../hooks/useRotatingMessages";
import { REVISE_LOADING_MESSAGES, type Principle, type SessionAction, type SessionState } from "../session";

type PosterProps = {
  state: SessionState;
  isFacilitator: boolean;
  myName: string;
  sendAction: (action: SessionAction) => void;
  onRevise: () => void;
  reviseLoading?: boolean;
  reviseError?: string | null;
};

// Covers the poster reveal and comments-loop phases (they share one card,
// mode-gated). The final printable view is a separate component,
// FinalPoster.tsx, matching the finalized wall-hanging design exactly.
export function Poster({ state, isFacilitator, myName, sendAction, onRevise, reviseLoading, reviseError }: PosterProps) {
  const principles = state.principles ?? [];
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Principle[]>([]);
  const commentTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const byline = `Written by ${state.teamName}${state.revised ? " · revised" : ""}`;
  const reviseLoadingLabel = useRotatingMessages(REVISE_LOADING_MESSAGES, !!reviseLoading);
  const commentsOpen = state.phase === "comments";

  function addComment(principleId: string) {
    const text = (commentDrafts[principleId] ?? (state.demoMode ? DEMO_COMMENT : "")).trim();
    if (!text) return;
    sendAction({ kind: "commentSubmit", principleId, name: myName, text });
    setCommentDrafts((d) => ({ ...d, [principleId]: "" }));
    // Reset the box back to its collapsed height — the value change alone
    // wouldn't shrink it back down since the grown height is an inline
    // style, not something that reacts to React re-renders on its own.
    const el = commentTextareaRefs.current[principleId];
    if (el) {
      el.value = "";
      autoGrow(el);
    }
  }

  function startEdit() {
    setEditDraft(principles.map((p) => ({ ...p })));
    setEditMode(true);
  }

  function saveEdit() {
    sendAction({ kind: "saveEditedPrinciples", principles: editDraft });
    setEditMode(false);
  }

  function deletePrinciple(principleId: string) {
    if (!window.confirm("Remove this principle? This can't be undone.")) return;
    sendAction({ kind: "deletePrinciple", principleId });
  }

  function deleteComment(principleId: string, index: number) {
    sendAction({ kind: "deleteComment", principleId, index });
  }

  // Grows the textarea to fit its content instead of scrolling internally —
  // called on mount (so a pre-filled demo comment starts at the right
  // height) and on every keystroke.
  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  const shown = editMode ? editDraft : principles;

  return (
    <div className="center-column wide-column">
      <div className="poster-card">
        <h2 className="poster-title">Our Principles</h2>
        <p className="poster-byline">{byline}</p>

        {shown.map((p, i) => (
          <div className="principle-row" key={p.id}>
            <span className="principle-numeral">{i + 1}</span>
            <div className="principle-body">
              {editMode ? (
                <>
                  <input
                    className="pill-input principle-edit-title"
                    value={p.title}
                    onChange={(e) =>
                      setEditDraft((d) => d.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)))
                    }
                  />
                  <textarea
                    className="answer-textarea"
                    value={p.body}
                    onChange={(e) =>
                      setEditDraft((d) => d.map((x) => (x.id === p.id ? { ...x, body: e.target.value } : x)))
                    }
                  />
                </>
              ) : (
                <>
                  <div className="principle-title-row">
                    <strong>{p.title}</strong>
                    {isFacilitator && commentsOpen && (
                      <button
                        type="button"
                        className="delete-link no-print"
                        onClick={() => deletePrinciple(p.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p>{p.body}</p>
                </>
              )}

              {commentsOpen && (
                <div className="comment-list no-print">
                  {(state.comments[p.id] ?? []).map((c, ci) => (
                    <p className="comment-item" key={ci}>
                      {isFacilitator && (
                        <button
                          type="button"
                          className="delete-x"
                          onClick={() => deleteComment(p.id, ci)}
                          aria-label="Remove comment"
                        >
                          ×
                        </button>
                      )}
                      <span className="comment-text">
                        <strong>{c.name}:</strong> {c.text}
                      </span>
                    </p>
                  ))}
                  <div className="comment-input-row">
                    <textarea
                      ref={(el) => {
                        commentTextareaRefs.current[p.id] = el;
                        autoGrow(el);
                      }}
                      className="comment-textarea"
                      rows={1}
                      value={commentDrafts[p.id] ?? (state.demoMode ? DEMO_COMMENT : "")}
                      onChange={(e) => {
                        setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }));
                        autoGrow(e.target);
                      }}
                      placeholder="Add a comment"
                    />
                    <button className="btn btn--primary" onClick={() => addComment(p.id)}>
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {state.phase === "poster" ? (
        isFacilitator ? (
          <button
            className="btn btn--primary no-print"
            onClick={() => sendAction({ kind: "setPhase", phase: "comments" })}
          >
            Open for comments →
          </button>
        ) : (
          <p className="subhead no-print">The facilitator will open this up for comments shortly.</p>
        )
      ) : isFacilitator ? (
        <div className="poster-actions no-print">
          {editMode ? (
            <>
              <button className="btn btn--outline" onClick={() => setEditMode(false)}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={saveEdit}>
                Save changes
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--secondary" onClick={onRevise} disabled={reviseLoading}>
                {reviseLoading ? reviseLoadingLabel : "Revise with Claude"}
              </button>
              <button className="btn btn--outline" onClick={startEdit}>
                Edit manually
              </button>
              <button className="btn btn--mint" onClick={() => sendAction({ kind: "setPhase", phase: "round3" })}>
                Continue to stress test →
              </button>
            </>
          )}
          {reviseError && <p className="error-text">{reviseError}</p>}
        </div>
      ) : (
        <p className="subhead no-print">Leave a comment on any principle — the facilitator will revise from here.</p>
      )}
    </div>
  );
}
