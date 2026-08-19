# GetGo Team Principles Builder

Realtime facilitation app for the Product team to co-write their working principles in one
session. See `../design_handoff_team_principles/` for the full design spec, screens, and product
flow — this repo currently implements the environment/plumbing plus a first vertical slice
(role select → name → lobby with live roster sync + a Claude-integration smoke test), not the
full 9-phase flow yet.

## Stack

- **Frontend**: React + Vite (SPA), in `packages/web`.
- **Backend logic**: `packages/functions` — Claude prompt logic lives in `src/core/claude.ts`
  (ported verbatim from the design prototype's prompts) and is shared by two runtimes:
  - `src/http/*.ts` + `src/ws/*.ts` — Lambda handlers, deployed via SST.
  - `src/local-dev/*.ts` — plain Node servers with the same behavior, for AWS-free local testing.
- **Realtime sync**: a simple room relay (whatever one client sends, every other client in the
  same room receives, verbatim). `src/local-dev/relay-server.ts` locally; API Gateway WebSocket
  API + DynamoDB (`src/ws/*.ts`) once deployed.
- **Infra**: SST (Ion) — `sst.config.ts` at the repo root, deploying to AWS Lambda.

## One-time machine setup

Already done on this machine as part of this setup session:

- [x] `nvm` installed (user-space, no sudo) → Node v24 LTS installed and set as default.
- [x] Project scaffolded and `npm install` run — all three local dev processes verified working.

Still to do, whenever you're ready:

- [ ] **AWS credentials** — not configured yet. When ready, tell me whether you'll use IAM
  Identity Center (SSO) or an IAM user's access keys, and I'll wire up `aws configure`.
  Nothing in this repo can deploy to AWS until this is done.
- [ ] **Anthropic API key** — copy `.env.example` to `.env.local` (already done) and paste your
  key into `ANTHROPIC_API_KEY`. Get one at https://console.anthropic.com/settings/keys.
  `.env.local` is git-ignored.

If you're setting this up on another machine from scratch:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
# open a new terminal, then:
nvm install --lts
cd app
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
```

## Running it locally

Three processes, one per terminal tab (or `npm run dev` from the repo root to run all three at
once via `concurrently`):

```sh
npm run dev:relay   # the realtime room relay      → ws://localhost:8787
npm run dev:api     # the Claude endpoints          → http://localhost:8788
npm run dev:web     # the React app                 → http://localhost:5173
```

None of this touches AWS — it's a fully local stand-in for the eventual deployed infra, using
the exact same message contract and the exact same Claude prompt code.

## Testing with multiple participants

This is the part that's different from a normal web app: the product only makes sense with
several people acting at once (facilitator + participants), so "does it work" isn't answerable
by loading `localhost:5173` alone. Three tiers, roughly in order of effort:

### 1. Solo iteration — multiple browser profiles (day-to-day default)

Open `http://localhost:5173` in:
- your normal Chrome window as the facilitator,
- one or two Incognito windows (or a second browser — Safari/Firefox) as participants.

Each window gets its own `localStorage`/session, so they behave like separate people while all
talking to the same relay + API processes on your machine. This is enough for iterating on the
flow yourself.

### 2. Real people, same office — LAN IP

Both `vite` and the relay/API servers are bound to `0.0.0.0`, so anyone on the same Wi-Fi can
join using **your machine's LAN IP** instead of `localhost`. When you run `npm run dev:relay` /
`npm run dev:api`, each prints its own LAN address, e.g.:

```
Local relay running.
  This machine:  ws://localhost:8787
  Same Wi-Fi:    ws://192.168.23.104:8787
```

To point the frontend at those instead of localhost, set in `.env.local` (then restart
`npm run dev:web`):

```
VITE_WS_URL=ws://192.168.23.104:8787
VITE_API_URL=http://192.168.23.104:8788
```

Give teammates `http://192.168.23.104:5173` to open on their own laptops/phones. Your Mac's
firewall may prompt to allow incoming connections the first time — allow it. (Your LAN IP
changes if you switch networks — rerun the dev servers to get the current one.)

### 3. Real people, not in the same room — deploy a personal dev stage

Once AWS credentials are set up, `npx sst dev` deploys a real (but cheap, isolated-per-you)
`sst dev --stage <yourname>` environment and live-reloads your Lambda code against it — so
remote teammates hit a real URL, not your laptop. This is the point where "local testing" and
"the real deployed thing" become the same infrastructure, just running your in-progress code.
We haven't done this yet since AWS isn't configured — happy to walk through it when you are.

### Automated regression check (later, optional)

Once the full flow is built out, a Playwright script driving several browser contexts through
join → answer → vote → comment in parallel would be a good regression check before a real team
session. Not built yet — flagged as a nice-to-have, not needed for day-to-day dev.

## Path to AWS / Lambda deployment

Not run yet — no AWS account configured on this machine. Once you're ready:

1. Set up credentials (`aws configure sso` or an IAM user's keys — your call).
2. `npx sst secret set AnthropicApiKey <your key> --stage <stage>`
3. `npx sst dev` — deploys a real dev stage and live-reloads your Lambda code against it. This
   is also the first real test of `sst.config.ts` and the `src/ws/*.ts`/`src/http/*.ts` handlers
   — see "Known gaps" below, since none of that has touched real AWS yet.
4. `npx sst deploy --stage production` when ready to ship.

### Known gaps to expect on first deploy

`sst.config.ts` and `packages/functions/src/ws/*.ts` were written against SST's documented
`ApiGatewayWebSocket` API, but unverified against real AWS (no account was configured while
building this). Likely things to fix on the first `sst dev`:

1. IAM permission for `execute-api:ManageConnections` on the WebSocket API for the `$default`
   route handler — SST's `ApiGatewayWebSocket` doesn't yet have a clean documented way to link
   an API to its own route handlers ([sst/sst#4633](https://github.com/sst/sst/issues/4633)).
   A best-effort `permissions` grant is already in `sst.config.ts`; may need adjusting once you
   see the actual IAM error.
2. `packages/functions`'s TypeScript build will show `Property 'X' does not exist on type
   'Resource'` errors until `npx sst dev` (or `npx sst types`) has run once against a configured
   AWS account — SST generates that type augmentation from `sst.config.ts`, and it doesn't exist
   yet. Not a bug, just not generated yet.

## What's built vs. what's left

Built: environment setup, monorepo structure, the realtime relay (local + AWS versions), all
three Claude calls ported server-side from the prototype, and screens 1–3 (role select, name
entry, lobby with live roster).

Not built yet: Rounds 1–3, topic synthesis/voting, the poster + comments loop, and the
facilitator-authoritative session-state model described in
`../design_handoff_team_principles/README.md` (State Management section) — the lobby roster
here is a simpler mesh-broadcast rather than "facilitator holds source of truth," which is fine
for a 3-screen slice but will need the real reducer once Round 1 is built.
