# GetGo Team Principles Builder

Realtime facilitation app for a product team to co-write their working principles in one
live session. The full 9-phase flow is built and working end to end (lobby → Round 1 → topic
synthesis → Round 2 → poster/comments → Round 3 → final poster).

Original design spec, screens, copy, and interaction rules live in
`../design_handoff_team_principles/README.md`, with round questions/scenarios/button copy
ported verbatim from `../design_handoff_team_principles/Team Principles.dc.html` (the original
interactive prototype). **That spec is the starting point, not the current source of truth** —
several product decisions made directly by the project owner during implementation
deliberately diverge from it (see "Where this app now differs from the original design spec"
below). Check this file and the actual code before assuming the design doc still describes
current behavior.

A second, later design handoff — `../Poster/README.md` and
`../Poster/Team Principles - Poster Export 3b.dc.html` — defines the *finalized* poster's exact
visual design (used by `FinalPoster.tsx` only; see below).

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

## The product flow, as actually built

Onboarding is now **role-inferred, not chosen** (`App.tsx`): whether the URL has a `?room=CODE`
param decides everything, captured once at mount (`useState(getRoomFromUrl)`) so it can't
change out from under the flow later —

- **No room code in the URL** → you're starting a new session → **facilitator** flow: enter
  name, team name (shown later as the poster's byline), and a **Demo mode On/Off toggle**
  (defaults to `.env.local`'s `VITE_DEMO_MODE`, but is now a per-session choice, not a fixed
  build-time flag — see "Demo mode" below). Confirming generates a room code, puts it in the
  URL (`setRoomInUrl`), and creates the session.
- **Room code already in the URL** (i.e. someone opened a link a facilitator shared) → you're
  joining an existing session → **participant** flow: name only. There is deliberately no
  manual room-code entry field — participants can only join via a link that already has the
  code embedded, never by typing a code in.

Phases after that (`SessionState.phase`, driven by `packages/web/src/session.ts`):

1. **`lobby`** — roster sync (`Lobby.tsx`); facilitator clicks "Start Round 1".
2. **`round1`** — 5 fixed questions (`ROUND1_PROMPTS`), 45s visual-only timer, submit → reveal →
   next, via the shared `AnswerRound.tsx` (also used by Round 3). Last question's "Next"
   triggers topic synthesis instead of just advancing.
3. **`synth1`** — Claude (or demo bypass) surfaces **`NUM_TOPICS` = 9** topics
   (`TopicSynthesis.tsx`). The prompt asks for "exactly N" and the code also defensively
   `.slice(0, numTopics)`s whatever comes back, so the count is enforced either way.
4. **`round2`** — pick **`MIN_TOPIC_PICKS` (2) to `MAX_TOPIC_PICKS` (3)** topics; every pick
   *requires* a written explanation (submit stays disabled otherwise, with a hint telling you
   which requirement is unmet). Once submissions are in, the facilitator clicks
   **"Reveal picks →"** — a step that shows the whole team every topic (sorted by pick count,
   including topics nobody picked, for transparency), who picked what, and why — *before*
   "Draft principles →" becomes available. (This reveal step is new; the original flow went
   straight from submit to drafting with no team-wide visibility.)
5. Claude drafts **`NUM_PRINCIPLES` = 6** principles from the picks/comments → phase becomes
   `poster`.
6. **`poster` → `comments`** (`Poster.tsx`) — facilitator opens for comments; the comment box is
   an auto-growing `<textarea>` (not the original fixed-height pill input), full-width and
   stacked above its "Add" button on phone-width screens. Facilitator can **Revise with
   Claude**, **Edit manually**, **delete an entire principle** (confirmation prompt — also
   deletes its comments), or **delete an individual comment** (no prompt) — the two delete
   actions are new, not in the original spec. The byline reads `Written by {teamName}` using
   the facilitator-entered team name, not a hardcoded string.
7. **`round3`** — 3 fixed scenarios (`ROUND3_SCENARIOS`), 30s timer. New vs. the original spec:
   participants must select **at least 1** principle that guided their answer (multi-select
   toggle chips, no upper cap) alongside their free-text answer; revealed-answer cards show
   each person's picked-principle chips next to their answer.
8. **`final`** — `FinalPoster.tsx`, a component **separate from `Poster.tsx`**, matching the
   *finalized* wall-hanging poster design in `../Poster/` pixel-for-pixel (GetGo mark,
   team-huddle watermark, six numbered rows) rather than the original prototype's poster
   layout. Facilitator can still edit or delete principles here, and choose an **A4/A3** print
   size toggle — both share identical 1:√2 proportions, so only the physical print output
   changes, via a dynamically-injected `@page` rule (see `applyPrintPaperSize` in
   `FinalPoster.tsx`), not the on-screen preview.

## Demo mode — now a synced session property, not a build flag

`VITE_DEMO_MODE=true` in `.env.local` still exists, but only as the **default value of the
onboarding toggle** — actual demo behavior now lives on `SessionState.demoMode`, chosen once by
the facilitator and broadcast to everyone, so a participant's screens prefill consistently with
the facilitator's choice even though they never see the toggle themselves (verified: a
participant with demo mode inherited from the facilitator sees the DEMO badge and prefilled
fields with no local env var of their own).

When on, every round's answer/pick/comment fields pre-fill with fixed placeholder content
(`packages/web/src/demo.ts`) and all three live Claude calls are bypassed with canned data, so
the whole flow can be clicked through solo without typing real answers or spending API calls.
Shows a red "DEMO" badge in the app bar.

Every screen that needs to know demo status reads it from `state.demoMode` (or a `demoMode`
prop threaded down from it) — never the raw `DEMO_MODE` constant from `demo.ts` directly, except
in `App.tsx`'s onboarding screen (where it's just the toggle's initial value) and inside
`demo.ts` itself.

## Where this app now differs from the original design spec

The original `../design_handoff_team_principles/README.md` is still the right reference for
tone, base copy, and the general shape of each screen — but these specific behaviors were
changed later, deliberately, by direct product decisions:

- No role-choice screen — role is inferred from the URL (see onboarding, above), not clicked.
- Facilitator now also names the team and chooses demo mode during onboarding.
- Round 2: "up to 2" picks became "2 to 3" picks, and per-pick explanations are now required,
  not optional. A team-wide reveal step was added before principle drafting.
- Round 3: principle-selection chips (which principles guided your answer) are new.
- The comments phase gained delete-principle and delete-comment controls.
- The final poster is a wholesale redesign (`FinalPoster.tsx`) matching a later, separate design
  handoff (`../Poster/`), not the original prototype's poster screen — different layout, added
  watermark/logo, A4/A3 print sizing.
- Topic count: 9, not ~10 as in the original prompt/spec.

## Frontend architecture: facilitator-authoritative state

The design spec calls for "facilitator holds source-of-truth state; participants send
actions; facilitator broadcasts full-state syncs," implemented entirely client-side on top of
the dumb relay (no backend changes):

- `packages/web/src/session.ts` — `SessionState`/`SessionAction`/`Phase` types, the pure
  `reducer(state, action)`, and constants (Round 1 questions, Round 3 scenarios, timers, pick
  caps, topic/principle counts, Claude-loading rotating-message sets).
- `packages/web/src/hooks/useSession.ts` — the only place that runs the reducer. On the
  facilitator's tab, `sendAction` runs the reducer and broadcasts the resulting state; on a
  participant's tab, `sendAction` just relays the action and waits for the next broadcast.
  Participants wholesale-replace local state on every `state` message — never merge.
- `packages/web/src/realtime.ts` — the dumb WS transport. Queues outgoing messages until the
  socket is actually `OPEN` (sending immediately after `new WebSocket()` silently drops the
  message otherwise — this was a real bug, see Gotchas).
- `packages/web/src/room.ts` — room codes (`?room=CODE` in the URL), now also the sole
  determinant of facilitator-vs-participant role at onboarding.
- `packages/web/src/screens/*.tsx` — one component per phase. `AnswerRound.tsx` is shared by
  `Round1.tsx` and `Round3.tsx` (identical question/reveal/next shape, principle-selector chips
  only rendered when Round 3 passes `principleOptions`). `Poster.tsx` covers the `poster` and
  `comments` phases; `final` is the separate `FinalPoster.tsx` (see above).
- `packages/web/src/components/` — `AppBar.tsx` (name/facilitator pill, participant-count pill,
  DEMO badge; the old dark "phase" pill was removed and its plumbing (`phaseLabel()` in
  `session.ts`) deleted along with it) and `FacilitatorFooter.tsx` (count label + action button,
  used by `AnswerRound`/`Round2`).
- `packages/web/src/api.ts` — typed client for the three Claude HTTP endpoints
  (`/topics`, `/principles`, `/revise`). Types are duplicated here rather than imported from
  `packages/functions/src/core/types.ts` — the web package has no dependency/path mapping onto
  `packages/functions`. Requests carry a 25s client-side `AbortController` timeout.
- **Known accepted limitation**: session state lives only in the facilitator's tab memory — a
  facilitator page refresh loses the session. No backend persistence is in scope.

## Mobile responsiveness

Real workshop participants use their own phones, so this got a real pass (not just "looks fine
on desktop"). Everything from Round 2 onward was audited and fixed for ~360-414px viewports.
Worth knowing before touching layout CSS again:

- **`min-width: 0` is required on flex children holding arbitrary-length text or a fixed-width
  form control, or they resist shrinking below their content/specified size and silently blow
  out their container** (`.comment-text`, `.principle-title-row > strong`, etc.). This is a
  well-known flexbox gotcha but easy to miss.
- **A fixed-width `<input>`'s `flex-shrink` can refuse to engage even with `min-width: 0` and
  `max-width: 100%` both set** — verified empirically in real Chromium, not just reasoned about
  (see `.comment-input-row .comment-textarea`'s CSS comment). The actual fix was overriding
  `flex-basis` to `0` (`flex: 1 1 0; width: auto;`) instead of leaving `flex-basis: auto` derive
  from a fixed pixel width. If a flex child still won't shrink after adding `min-width: 0`,
  suspect this next.
- **CSS percentage `padding`/`margin` resolve against the containing block's *width*, even for
  top/bottom** — used deliberately on `.final-poster-page`/`.final-poster-row` so padding scales
  proportionally with the A4/A3-proportioned box instead of eating a fixed 80px regardless of
  viewport (which used to silently clip principles 5-6 via `overflow: hidden` on narrow
  screens).
- **`height: 100vh` in `@media print` means the browser's on-screen viewport, not the physical
  printed page** — caused the final poster to spill onto a second printed page when the
  on-screen window was taller than one A4/A3 sheet. Print sizing should come from content +
  `@page` alone, not a forced viewport-relative height.
- A phone-width breakpoint (`@media (max-width: 600px)`) stacks the comment input/button
  vertically and drops `.comment-list`'s left indent, rather than trying to keep everything in
  one cramped row.

**No headless browser/device emulator existed in this environment by default.** When CSS-only
reasoning wasn't enough to find/verify a real overflow bug, `npx playwright install chromium`
(downloads to `~/Library/Caches/ms-playwright`, persists across sessions) plus a scratch
`npm install playwright` in a temp working directory got a real Chromium instance driving the
actual running dev server — set a `viewport`, click through the flow (demo mode makes this
fast), and check `document.documentElement.scrollWidth` vs `clientWidth` for real overflow,
walking the DOM for the specific offending element when it's `true`. Far more reliable than
guessing from CSS alone once things get non-obvious — reach for this before spending a long time
theorizing about flex/box-model behavior.

## Local dev

```sh
npm run dev            # all three: relay (:8787), API (:8788), web (:5173)
npm run dev:relay
npm run dev:api
npm run dev:web
```

Multi-participant testing: open the app in several browser profiles/incognito windows
(same-machine, via room codes — note a *facilitator* link is what gets shared, since that's the
only way a participant can join at all now), or use the LAN IP printed by the relay/API servers
for real devices on the same Wi-Fi. See the main `README.md` for the full tiered testing
approach.

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
- **`isFacilitator`/room-role must be captured once at mount, not re-derived from the URL on
  every render.** The facilitator's own `confirmName()` writes a freshly-generated room code
  into the URL as a side effect — reading `getRoomFromUrl()` fresh on a later render would see
  that code and incorrectly flip them to "participant" the instant they start their own session.
  `App.tsx` freezes it via `useState(getRoomFromUrl)` instead of a plain function call.
- **Flexbox `min-width`/`flex-basis` gotchas** — see "Mobile responsiveness" above.

## What's built vs. not

**Built**: the entire 9-phase flow described above, end to end, with live Claude integration,
demo mode, mobile-responsive layout (Round 2 onward, audited against real viewport widths), and
the realtime relay (local + AWS versions, AWS unverified).

**Not built**: AWS deployment (no credentials configured — nothing can deploy yet), the
documented WebSocket IAM permission gap and SST type-generation gap (see `README.md` "Known
gaps"), and backend session-state persistence (state is facilitator-tab-memory only — a
facilitator refresh still loses the session, which is an accepted limitation, not a bug to fix
opportunistically).
