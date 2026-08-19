import type { SessionAction, SessionState } from "../session";

type LobbyProps = {
  state: SessionState;
  isFacilitator: boolean;
  myId: string;
  roomCode: string;
  sendAction: (action: SessionAction) => void;
};

export function Lobby({ state, isFacilitator, myId, roomCode, sendAction }: LobbyProps) {
  return (
    <div className="center-column">
      <h2 className="lobby-headline">You're in.</h2>
      <p className="subhead">Waiting for the session to start.</p>

      <div className="roster">
        {state.participants.map((p) => (
          <span className="roster-chip" key={p.id}>
            {p.name}
            {p.id === myId ? " (you)" : ""}
          </span>
        ))}
      </div>

      {isFacilitator ? (
        <>
          <p className="subhead">
            Room code <strong>{roomCode}</strong> — share this page's link so others can join.
          </p>
          <button className="btn btn--primary" onClick={() => sendAction({ kind: "startRound1" })}>
            Start Round 1
          </button>
        </>
      ) : (
        <p className="subhead">Hang tight — the facilitator will start things off.</p>
      )}
    </div>
  );
}
