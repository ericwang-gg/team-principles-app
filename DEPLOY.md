# Deploy runbook (for whoever is running `sst deploy`)

This app's infrastructure is fully defined as code in [`sst.config.ts`](./sst.config.ts) — SST v3
("Ion") reads that file and provisions everything directly against AWS APIs (no CloudFormation
involved; it manages its own state in an S3 bucket it creates on first run). There is nothing to
configure by hand in the AWS console — running the commands below is the entire deploy.

## What this creates in AWS

| Resource | Purpose |
|---|---|
| DynamoDB table `Connections` | Maps WebSocket `connectionId` ↔ `room` for the realtime relay |
| API Gateway WebSocket API | Realtime relay (`$connect`/`$disconnect`/`$default` routes) |
| API Gateway HTTP API | Three Claude endpoints: `/topics`, `/principles`, `/revise` |
| 5 Lambda functions | The above WS routes + HTTP routes |
| S3 + CloudFront static site | The built React app (`packages/web`) |
| SST-managed bootstrap (S3 state/asset buckets, ECR repo, SSM params) | SST's own deploy state — created automatically, once per account/region |

## 1. Prerequisites

- **AWS credentials** with sufficient IAM permissions. If you were sent an IAM policy JSON
  separately for this — that's the one to attach. Summary: SST needs specific S3/ECR/SSM
  permissions for its own bootstrap state, plus broad permissions for whatever the app itself
  provisions (Lambda, DynamoDB, API Gateway, S3, IAM role creation for each function) since that
  scope depends on what's in `sst.config.ts` and isn't practical to enumerate by hand — SST's own
  docs ship a wildcard template for that reason. `AdministratorAccess` is the simplest option if
  this is a dedicated/sandbox account.
- **Node.js** — version pinned in [`.nvmrc`](./.nvmrc). `nvm install && nvm use` if you have `nvm`.
- **The Anthropic API key** for this app — sent to you separately, **not** in this repo. Never put
  it in a file that gets committed; it's set as an SST secret (step 3 below).

## 2. Install dependencies

```sh
npm install
```

## 3. Set the Anthropic API key secret

SST secrets are stored encrypted in SSM, per stage — not in `.env` files:

```sh
npx sst secret set AnthropicApiKey <the-key-you-were-sent> --stage production
```

(Replace `production` with whatever stage name you're deploying — see stage naming below.)

## 4. Deploy

```sh
npx sst deploy --stage production
```

First deploy in a fresh account/region also runs SST's bootstrap step automatically (creates its
state/asset S3 buckets, an ECR repo, and an SSM parameter) — no separate command needed for that.

On success, SST prints the deployed URLs (web app, WebSocket endpoint, Claude API endpoint).

### Stage naming

- `production` is the only stage name with `removal: "retain"` in `sst.config.ts` — meaning if the
  stack is ever removed, the DynamoDB table is kept rather than deleted. Every other stage name
  (e.g. a personal dev stage) tears down cleanly on `sst remove`.
- Use `production` for the real deploy. Use anything else (e.g. `--stage <yourname>`) for a
  throwaway test deploy first if you want to sanity-check the process before committing to
  `production`.

## 5. Known gaps to expect on this *first* deploy

This config has not yet been run against real AWS, so expect to iterate once on these two
documented rough edges (see [`README.md`](./README.md#known-gaps-to-expect-on-first-deploy) for
more detail):

1. **WebSocket IAM permission** — the `$default` route handler needs
   `execute-api:ManageConnections` to message other connected clients. A best-effort `permissions`
   grant is already in `sst.config.ts`; if you see an `AccessDenied` calling
   `PostToConnection`/similar from that Lambda's logs, that grant likely needs adjusting.
2. **TypeScript `Resource` type errors** in `packages/functions` — expected and harmless until
   `sst deploy`/`sst dev` has run once against this account; SST generates that type augmentation
   from `sst.config.ts` and it doesn't exist before the first run.

## 6. Sanity-check after deploy

- Open the printed web URL — you should land on "Let's write our principles." with a single
  "Get started" button (a fresh URL with no `?room=` always means the facilitator flow now —
  there's no role-picker screen). Confirming a name generates a room code into the URL; open
  that same URL in another browser/incognito window and it should show "You're joining a
  session" with a "Continue" button instead, confirming the WebSocket relay round-trips.
- `VITE_WS_URL`/`VITE_API_URL` are wired into the build automatically from the deployed API URLs
  (see the `environment` block on the `Web` `StaticSite` in `sst.config.ts`) — no manual `.env`
  edits needed post-deploy. `VITE_DEMO_MODE` is deliberately *not* set here, so demo mode
  defaults to off in production (it's a per-session toggle the facilitator can still turn on
  from the onboarding screen — see `CLAUDE.md`'s "Demo mode" section).

## Redeploying later

Same command, `npx sst deploy --stage production` — SST diffs against its stored state and only
changes what's different.
