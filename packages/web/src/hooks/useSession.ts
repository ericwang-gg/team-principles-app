import { useCallback, useEffect, useRef, useState } from "react";
import { joinRoom, type RoomConnection } from "../realtime";
import { createInitialSession, reducer, type SessionAction, type SessionState } from "../session";

export type UseSessionArgs = {
  room: string;
  myId: string;
  myName: string;
  isFacilitator: boolean;
  // Only meaningful for the facilitator, who's the one who seeds the
  // session — participants get it from the facilitator's broadcast state.
  teamName: string;
  demoMode: boolean;
};

export type UseSessionResult = {
  state: SessionState | null;
  wsStatus: "connecting" | "open" | "closed";
  // Every screen calls this regardless of role: on the facilitator's tab it
  // runs the reducer and broadcasts the result; on a participant's tab it
  // just sends the action and waits for the next broadcast to reflect it.
  sendAction: (action: SessionAction) => void;
};

export function useSession({ room, myId, myName, isFacilitator, teamName, demoMode }: UseSessionArgs): UseSessionResult {
  const [state, setState] = useState<SessionState | null>(
    isFacilitator ? createInitialSession(myId, myName, teamName, demoMode) : null
  );
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const connectionRef = useRef<RoomConnection | null>(null);

  // Runs the reducer and broadcasts the resulting state — the only place
  // that ever mutates SessionState. Called both for the facilitator's own UI
  // actions and for `action` messages relayed in from participants.
  const applyAndBroadcast = useCallback(
    (action: SessionAction) => {
      setState((prev) => {
        const base = prev ?? createInitialSession(myId, myName, teamName, demoMode);
        const next = reducer(base, action);
        connectionRef.current?.send({ kind: "state", state: next });
        return next;
      });
    },
    [myId, myName, teamName, demoMode]
  );

  const sendAction = useCallback(
    (action: SessionAction) => {
      if (isFacilitator) applyAndBroadcast(action);
      else connectionRef.current?.send({ kind: "action", action });
    },
    [isFacilitator, applyAndBroadcast]
  );

  useEffect(() => {
    const connection = joinRoom(
      room,
      (message) => {
        if (isFacilitator) {
          if (message.kind === "action") applyAndBroadcast(message.action);
          // facilitator ignores stray "state" messages — it IS the source of truth
        } else if (message.kind === "state") {
          setState(message.state);
        }
      },
      setWsStatus
    );
    connectionRef.current = connection;

    if (!isFacilitator) {
      // `join` gets us into the roster on the next broadcast; `requestState`
      // covers the case where nothing else changes afterward (e.g. a
      // refreshed tab rejoining mid-round) by forcing a rebroadcast anyway.
      connection.send({ kind: "action", action: { kind: "join", id: myId, name: myName } });
      connection.send({ kind: "action", action: { kind: "requestState" } });
    }

    const announceLeave = () => connection.send({ kind: "action", action: { kind: "leave", id: myId } });
    window.addEventListener("beforeunload", announceLeave);

    return () => {
      window.removeEventListener("beforeunload", announceLeave);
      announceLeave();
      connectionRef.current = null;
      connection.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return { state, wsStatus, sendAction };
}
