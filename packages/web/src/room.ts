// Room codes replace the old hardcoded `ROOM = "demo"` so fresh sessions
// don't collide with stale ones — needed for testing locally with multiple
// browser profiles acting as facilitator + participants at once.

const ROOM_PARAM = "room";

export function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function getRoomFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get(ROOM_PARAM) || null;
}

export function setRoomInUrl(code: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(ROOM_PARAM, code);
  window.history.replaceState(null, "", url);
}
