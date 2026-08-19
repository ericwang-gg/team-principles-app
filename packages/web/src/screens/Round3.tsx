import { AnswerRound } from "./AnswerRound";
import { ROUND3_SCENARIOS, ROUND_TIMER_SECONDS, type SessionAction, type SessionState } from "../session";

type Round3Props = {
  state: SessionState;
  isFacilitator: boolean;
  myId: string;
  myName: string;
  sendAction: (action: SessionAction) => void;
};

export function Round3({ state, isFacilitator, myId, myName, sendAction }: Round3Props) {
  const round = state.round3;
  const isLast = round.currentIndex === ROUND3_SCENARIOS.length - 1;
  const questions = ROUND3_SCENARIOS.map((s) => ({ key: s.key, text: s.title, subtext: s.prompt }));

  return (
    <AnswerRound
      roundKey="round3"
      roundLabel="Round 3"
      questions={questions}
      round={round}
      timerSeconds={ROUND_TIMER_SECONDS.round3}
      isFacilitator={isFacilitator}
      myId={myId}
      demoMode={state.demoMode}
      participants={state.participants}
      waitingHeadline="Thanks for that."
      nextLabel={isLast ? "Finalize →" : "Next question →"}
      onSubmitAnswer={(promptKey, value, principleIds) =>
        sendAction({
          kind: "roundAnswer",
          roundKey: "round3",
          promptKey,
          id: myId,
          name: myName,
          value,
          principleIds,
        })
      }
      principleOptions={state.principles ?? undefined}
      principleSelections={state.round3PrincipleSelections}
      onReveal={() => sendAction({ kind: "revealQuestion", roundKey: "round3" })}
      onNext={() => {
        if (isLast) sendAction({ kind: "finalize" });
        else sendAction({ kind: "nextQuestion", roundKey: "round3" });
      }}
      headerExtra={
        state.principles ? (
          <div className="scenario-strip">
            <p className="subhead">Stress-testing the principles we just landed on</p>
          </div>
        ) : undefined
      }
    />
  );
}
