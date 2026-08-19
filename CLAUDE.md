# GetGo Team Principles Builder

Realtime facilitation app for a product team to co-write their working principles in one
live session. Full design spec, screens, copy, and interaction rules live in
`../design_handoff_team_principles/README.md` — read that before touching any UI/flow work,
since round questions, scenarios, and button copy are ported verbatim from
`../design_handoff_team_principles/Team Principles.dc.html` (the original interactive
prototype) and shouldn't be reinvented.

## Stack

- **Monorepo**: npm workspaces — `packages/web` (React + Vite SPA), `packages/functions`
  (backend logic shared between two runtimes).
- **Backend runtimes**: `packages/functions/src/http/*.ts` + `src/ws/*.ts` are Lambda
  handlers (deployed via SST); `src/local-dev/*.ts` are plain Node servers with identical
  behavior, for AWS-free local dev. Both call the same `src/core/claude.ts`.
- **Realtime transport**: a dumb relay — whatever one client sends is fanned out verbatim to
  every other client in the same room. No server-side memory of session content. Local via the
  `ws` package (`local-dev/relay-server.ts`); prod via API Gateway WebSocket + DynamoDB
  (`src/ws/*.ts`) — the prod path is unverified against real AWS (no account configured yet).
- **Infra**: SST (Ion), `sst.config.ts` at repo root. Not deployed — no AWS credentials
  configured on this machine.

## Frontend architecture: facilitator-authoritative state

The design spec calls for "facilitator holds source-of-truth state; participants send
actions; facilitator broadcasts full-state syncs," implemented entirely client-side on top of
the dumb relay (no backend changes):

- `packages/web/src/session.ts` — `SessionState`/`SessionAction`/`Phase` types, the pure
  `reducer(state, action)`, and constants ported verbatim from the prototype (Round 1
  questions, Round 3 scenarios, timers, pick caps).
- `packages/web/src/hooks/useSession.ts` — the only place that runs the reducer. On the
  facilitator's tab, `sendAction` runs the reducer and broadcasts the resulting state; on a
  participant's tab, `sendAction` just relays the action and waits for the next broadcast.
  Participants wholesale-replace local state on every `state` message — never merge.
- `packages/web/src/realtime.ts` — the dumb WS transport. Queues outgoing messages until the
  socket is actually `OPEN` (sending immediately after `new WebSocket()` silently drops the
  message otherwise — this was a real bug, see Gotchas).
- `packages/web/src/room.ts` — room codes (`?room=CODE` in the URL) so multiple local browser
  profiles can join the same test session deliberately, replacing an earlier hardcoded room.
- `packages/web/src/screens/*.tsx` — one component per phase
  (`lobby → round1 → synth1 → round2 → poster → comments → round3 → final`). Round 1 and
  Round 3 share one `AnswerRound.tsx` (identical question/reveal/next shape); `Poster.tsx`
  covers poster/comments/final in one mode-gated component.
- `packages/web/src/api.ts` — typed client for the three Claude HTTP endpoints
  (`/topics`, `/principles`, `/revise`). Types are duplicated here rather than imported from
  `packages/functions/src/core/types.ts` — the web package has no dependency/path mapping onto
  `packages/functions`.
- **Known accepted limitation**: session state lives only in the facilitator's tab memory — a
  facilitator page refresh loses the session. No backend persistence is in scope.

## Test/demo mode

`VITE_DEMO_MODE=true` in `.env.local` pre-fills every round's answer/pick/comment fields with
fixed placeholder content (`packages/web/src/demo.ts`) and bypasses all three live Claude calls
with canned data, so the whole multi-screen flow can be clicked through solo (e.g. across
several browser profiles) without typing real answers or spending API calls. Shows a red
"DEMO" badge in the app bar. Requires a full web dev-server restart after toggling (see
Gotchas — env vars aren't hot-reloadable).

## Local dev

```sh
npm run dev            # all three: relay (:8787), API (:8788), web (:5173)
npm run dev:relay
npm run dev:api
npm run dev:web
```

Multi-participant testing: open the app in several browser profiles/incognito windows
(same-machine, via room codes), or use the LAN IP printed by the relay/API servers for real
devices on the same Wi-Fi. See the main `README.md` for the full tiered testing approach.

## Gotchas (things that actually broke, worth knowing before debugging blind)

- **Vite only loads `.env*` files from its own project root by default** — for this monorepo
  that's `packages/web/`, NOT the repo root where `.env.local` actually lives. Fixed via
  `envDir: "../../"` in `packages/web/vite.config.ts`. Before that fix, `VITE_WS_URL`/
  `VITE_API_URL` appeared to work purely by coincidence (their code fallbacks matched
  `.env.local`'s values) while `VITE_DEMO_MODE` silently never turned on. To verify Vite is
  actually injecting a given env var, curl the dev server's transformed source
  (`curl http://localhost:5173/src/<file>.ts`) and check the literal `import.meta.env` object
  at the top — don't trust the file contents alone.
- **Env vars are not hot-reloadable.** Changing `.env.local` or `vite.config.ts` requires
  killing and restarting the web dev server (`lsof -ti:5173 | xargs kill`, then
  `npm run dev:web`) — a page refresh alone reconnects to the same stale process.
- **A message sent immediately after `new WebSocket(...)` is silently dropped** — the socket
  is still `CONNECTING`, not `OPEN`. `realtime.ts` queues sends and flushes on `onopen`.
- **Killing only the port-bound process leaves orphans.** `npm run dev` runs `concurrently`
  wrapping three `tsx watch` processes; killing e.g. just the PID on `:8788` leaves the
  `concurrently` supervisor and sibling processes running. To fully clean up:
  `pgrep -fl "Documents/Build/Principles/app" | grep -v "Code Helper"` then kill everything
  listed, rather than just the `lsof -ti:<port>` PID.
- **`Property 'X' does not exist on type 'Resource'` in `packages/functions`** (`src/http/*.ts`,
  `src/ws/*.ts`) is expected and not a bug — SST generates that type augmentation from
  `sst.config.ts` only after `npx sst dev`/`npx sst types` has run once against a configured
  AWS account, which hasn't happened yet.
- **Claude call timeouts are deliberately staggered**: 20s server-side (`claude.ts`'s
  Anthropic client) vs 25s client-side (`api.ts`'s `AbortController`), both comfortably under
  API Gateway's hard 29s integration timeout for whenever this deploys — so a stuck call
  surfaces as a real server error rather than a client-side abort.

## What's built vs. not

Built: environment/plumbing, the realtime relay (local + AWS versions, AWS unverified), all
three Claude calls, and the full 9-phase flow (role select → name → lobby → Round 1 → topic
synthesis → Round 2 → poster/comments → Round 3 → final poster), plus demo/test mode.

Not built: AWS deployment (no credentials configured — nothing can deploy yet), the documented
WebSocket IAM permission gap and SST type-generation gap (see `README.md` "Known gaps"),
backend session-state persistence (state is facilitator-tab-memory only), and pixel-perfect
design-token fidelity across every screen (functional correctness was prioritized first).
