// Local-only stand-in for the production WebSocket relay (API Gateway
// WebSocket API + DynamoDB connections table, see src/ws/*.ts). Same
// contract: any message a client sends is fanned out to every other client
// in the same `room`, verbatim. This lets you test the full multi-participant
// flow — join, answer, vote, comment — without any AWS setup.
//
// Bound to 0.0.0.0 so teammates on the same Wi-Fi can join too: give them
// the "Same Wi-Fi" URL printed below as VITE_WS_URL.
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";

// Load repo-root .env.local regardless of which directory this is run from.
const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, "../../../../.env.local");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const PORT = process.env.RELAY_PORT ? Number(process.env.RELAY_PORT) : 8787;

type Client = WebSocket & { room?: string };

const rooms = new Map<string, Set<Client>>();

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("connection", (ws: Client, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const room = url.searchParams.get("room") || "default";
  ws.room = room;

  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room)!.add(ws);
  console.log(`[relay] join room=${room} (${rooms.get(room)!.size} connected)`);

  ws.on("message", (data) => {
    const peers = rooms.get(room);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === peer.OPEN) peer.send(data.toString());
    }
  });

  ws.on("close", () => {
    rooms.get(room)?.delete(ws);
    console.log(`[relay] leave room=${room} (${rooms.get(room)?.size ?? 0} connected)`);
  });
});

function lanAddress(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

console.log(`Local relay running.`);
console.log(`  This machine:  ws://localhost:${PORT}`);
console.log(`  Same Wi-Fi:    ws://${lanAddress()}:${PORT}`);
console.log(`  -> other devices on the same Wi-Fi should set VITE_WS_URL to the "Same Wi-Fi" line above.`);
