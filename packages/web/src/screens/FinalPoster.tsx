import { useEffect, useState } from "react";
import type { Principle, SessionAction, SessionState } from "../session";

type FinalPosterProps = {
  state: SessionState;
  isFacilitator: boolean;
  sendAction: (action: SessionAction) => void;
};

type PaperSize = "a4" | "a3";

// A4 and A3 share the same 1:√2 proportions (A3 is exactly double the area),
// so the on-screen page shape never needs to change — only the physical
// print/PDF output size does, via a dynamically-injected @page rule.
const PRINT_STYLE_ID = "final-poster-print-size";

function applyPrintPaperSize(size: PaperSize) {
  let styleEl = document.getElementById(PRINT_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = PRINT_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@page { size: ${size === "a3" ? "A3" : "A4"}; margin: 0; }`;
}

// Matches the finalized print/wall-hanging poster design exactly
// (../../../Poster/Team Principles - Poster Export 3b.dc.html) — a single
// page, GetGo mark + team-huddle watermark, six numbered rows filling
// the page via space-between. Deliberately distinct from the in-flow
// poster/comments card in Poster.tsx, which the design spec calls out as
// not yet restyled to match this finalized direction.
export function FinalPoster({ state, isFacilitator, sendAction }: FinalPosterProps) {
  const principles = state.principles ?? [];
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Principle[]>([]);
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");

  useEffect(() => {
    applyPrintPaperSize(paperSize);
    // Left in place on unmount deliberately — if the browser's own Cmd/Ctrl+P
    // is used instead of our Print button, the size should still apply.
  }, [paperSize]);

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

  const shown = editMode ? editDraft : principles;

  return (
    <div className="center-column wide-column">
      <div className={`final-poster-page${editMode ? " editing" : ""}`}>
        <img src="/deco-teamhuddle.png" className="final-poster-watermark" alt="" />
        <img src="/getgo-logo-black.svg" className="final-poster-logo" alt="GetGo" />
        <div className="final-poster-title">Team Principles</div>
        <div className="final-poster-credit">{state.teamName}</div>
        <div className="final-poster-rows">
          {shown.map((p, i) => (
            <div className="final-poster-row" key={p.id}>
              <div className="final-poster-num">{i + 1}</div>
              <div className="final-poster-body">
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
                      <div className="final-poster-row-title">{p.title}</div>
                      {isFacilitator && (
                        <button
                          type="button"
                          className="delete-link no-print"
                          onClick={() => deletePrinciple(p.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="final-poster-row-body">{p.body}</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isFacilitator && editMode ? (
        <div className="poster-actions no-print">
          <button className="btn btn--outline" onClick={() => setEditMode(false)}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={saveEdit}>
            Save changes
          </button>
        </div>
      ) : (
        <div className="poster-actions no-print">
          {isFacilitator && (
            <button className="btn btn--outline" onClick={startEdit}>
              Edit manually
            </button>
          )}
          <div className="paper-size-toggle">
            <span className="subhead">Paper size</span>
            <button
              type="button"
              className={`toggle-pill${paperSize === "a4" ? " toggle-pill--on" : ""}`}
              onClick={() => setPaperSize("a4")}
            >
              A4
            </button>
            <button
              type="button"
              className={`toggle-pill${paperSize === "a3" ? " toggle-pill--on" : ""}`}
              onClick={() => setPaperSize("a3")}
            >
              A3
            </button>
          </div>
          <button className="btn btn--outline" onClick={() => window.print()}>
            Print
          </button>
        </div>
      )}
    </div>
  );
}
