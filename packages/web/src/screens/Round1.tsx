import { AnswerRound } from "./AnswerRound";
import { useRotatingMessages } from "../hooks/useRotatingMessages";
import {
  ROUND1_PROMPTS,
  ROUND_TIMER_SECONDS,
  SYNTH_LOADING_MESSAGES,
  type SessionAction,
  type SessionState,
} from "../session";

type Round1Props = {
  state: SessionState;
  isFacilitator: boolean;
  myId: string;
  myName: string;
  sendAction: (action: SessionAction) => void;
  onSynthesize: () => void;
  synthLoading?: boolean;
  synthError?: string | null;
};

export function Round1({
  state,
  isFacilitator,
  myId,
  myName,
  sendAction,
  onSynthesize,
  synthLoading,
  synthError,
}: Round1Props) {
  const round = state.round1;
  const isLast = round.currentIndex === ROUND1_PROMPTS.length - 1;
  const synthLoadingLabel = useRotatingMessages(SYNTH_LOADING_MESSAGES, !!synthLoading);

  return (
    <AnswerRound
      roundKey="round1"
      roundLabel="Round 1"
      questions={ROUND1_PROMPTS}
      round={round}
      timerSeconds={ROUND_TIMER_SECONDS.round1}
      isFacilitator={isFacilitator}
      myId={myId}
      demoMode={state.demoMode}
      participants={state.participants}
      waitingHeadline="Got it."
      nextLabel={isLast ? "Synthesize topics →" : "Next question →"}
      onSubmitAnswer={(promptKey, value) =>
        sendAction({ kind: "roundAnswer", roundKey: "round1", promptKey, id: myId, name: myName, value })
      }
      onReveal={() => sendAction({ kind: "revealQuestion", roundKey: "round1" })}
      onNext={() => {
        if (isLast) onSynthesize();
        else sendAction({ kind: "nextQuestion", roundKey: "round1" });
      }}
      nextLoading={synthLoading}
      nextLoadingLabel={synthLoadingLabel}
      nextError={synthError}
    />
  );
}
