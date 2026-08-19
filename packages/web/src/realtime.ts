// Thin client for the room relay (packages/functions/src/local-dev/relay-server.ts
// locally, or the API Gateway WebSocket API once deployed — same message
// contract either way: whatever you `send` is relayed verbatim to every
// other participant in the same room).
//
// The relay itself is dumb transport with no memory of session content — all
// "who's the source of truth" logic lives in useSession/session.ts. Only two
// message kinds cross the wire: participants send `action`s, the facilitator
// broadcasts full `state` syncs.
import type { SessionAction, SessionState } from "./session";

export type RelayMessage = { kind: "action"; action: SessionAction } | { kind: "state"; state: SessionState };

export type RoomConnection = {
  send: (message: RelayMessage) => void;
  close: () => void;
};

export function joinRoom(
  room: string,
  onMessage: (message: RelayMessage) => void,
  onStatusChange?: (status: "connecting" | "open" | "closed") => void
): RoomConnection {
  const base = import.meta.env.VITE_WS_URL || "ws://localhost:8787";
  const url = `${base}?room=${encodeURIComponent(room)}`;
  const ws = new WebSocket(url);
  // A message sent the instant the socket is constructed would otherwise be
  // silently dropped — the WebSocket is still CONNECTING, not OPEN, until
  // `onopen` fires. Queue anything sent before then and flush on open.
  const queue: RelayMessage[] = [];

  onStatusChange?.("connecting");
  ws.onopen = () => {
    for (const message of queue.splice(0)) ws.send(JSON.stringify(message));
    onStatusChange?.("open");
  };
  ws.onclose = () => onStatusChange?.("closed");
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore malformed messages
    }
  };

  return {
    send: (message) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
      else if (ws.readyState === WebSocket.CONNECTING) queue.push(message);
    },
    close: () => ws.close(),
  };
}
