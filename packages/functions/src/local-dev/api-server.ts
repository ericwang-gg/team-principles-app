// Local-only stand-in for the production Claude HTTP endpoints (API Gateway
// HTTP API + Lambda, see src/http/*.ts). Same handlers, same request/response
// shape — just running in plain Node so you don't need AWS to test the
// Claude integration end to end.
import { existsSync } from "node:fs";
import http from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load repo-root .env.local regardless of which directory this is run from.
const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, "../../../../.env.local");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const { draftPrinciples, revisePrinciples, synthesizeTopics } = await import("../core/claude.js");

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8788;

const routes: Record<string, (input: any) => Promise<any>> = {
  "/topics": (input) => synthesizeTopics(input).then((topics) => ({ topics })),
  "/principles": (input) => draftPrinciples(input).then((principles) => ({ principles })),
  "/revise": (input) => revisePrinciples(input).then((principles) => ({ principles })),
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const fn = req.url ? routes[req.url] : undefined;
  if (!fn || req.method !== "POST") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const input = JSON.parse(body || "{}");
      const result = await fn(input);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Local Claude API running.`);
  console.log(`  This machine:  http://localhost:${PORT}`);
  console.log(`  Same Wi-Fi:    http://${lanAddress()}:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(`  WARNING: ANTHROPIC_API_KEY is not set — Claude calls will fail until you add it to .env.local`);
  }
});
