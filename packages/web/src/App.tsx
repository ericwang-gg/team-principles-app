import { useState } from "react";
import { draftPrinciples, revisePrinciples, synthesizeTopics } from "./api";
import { AppBar } from "./components/AppBar";
import { DEMO_MODE, DEMO_PRINCIPLES, DEMO_TOPICS, demoRevise } from "./demo";
import { useSession } from "./hooks/useSession";
import { generateRoomCode, getRoomFromUrl, setRoomInUrl } from "./room";
import { NUM_PRINCIPLES, NUM_TOPICS, ROUND1_PROMPTS } from "./session";
import { FinalPoster } from "./screens/FinalPoster";
import { Lobby } from "./screens/Lobby";
import { Poster } from "./screens/Poster";
import { Round1 } from "./screens/Round1";
import { Round2 } from "./screens/Round2";
import { Round3 } from "./screens/Round3";
import { TopicSynthesis } from "./screens/TopicSynthesis";

type View = "intro" | "name" | "session";

function genId() {
  return "u-" + Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const [view, setView] = useState<View>("intro");
  const [nameInput, setNameInput] = useState("");
  const [teamNameInput, setTeamNameInput] = useState("");
  const [demoModeInput, setDemoModeInput] = useState(DEMO_MODE);
  const [myName, setMyName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [demoMode, setDemoMode] = useState(DEMO_MODE);
  const [room, setRoom] = useState("");
  const [myId] = useState(genId);

  // A room code in the URL means someone is following a link a facilitator
  // shared, so they're joining an already-started session — otherwise
  // there's no session yet, and they're the one starting it. Captured once
  // at mount (not read fresh every render): confirmName() below writes a
  // freshly-generated code into the URL for the facilitator, which would
  // otherwise flip isFacilitator to false the instant they continue.
  const [urlRoom] = useState(getRoomFromUrl);
  const isFacilitator = !urlRoom;

  function confirmName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    if (isFacilitator) {
      const trimmedTeamName = teamNameInput.trim();
      if (!trimmedTeamName) return;
      const code = generateRoomCode();
      setRoomInUrl(code);
      setRoom(code);
      setTeamName(trimmedTeamName);
      setDemoMode(demoModeInput);
    } else {
      setRoom(urlRoom!);
    }
    setMyName(trimmed);
    setView("session");
  }

  if (view === "intro") {
    return (
      <div className="app-shell">
        <div className="center-column">
          <h1 className="hero">Let's write our principles.</h1>
          <p className="subhead">
            {isFacilitator
              ? "You'll be facilitating this session."
              : "You're joining a session already in progress."}
          </p>
          <button className="btn btn--primary" onClick={() => setView("name")}>
            {isFacilitator ? "Get started" : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  if (view === "name") {
    return (
      <div className="app-shell">
        <div className="center-column">
          <h1 className="hero">What's your name?</h1>
          <input
            className="pill-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
            placeholder="Your name"
            autoFocus
          />
          {isFacilitator && (
            <>
              <input
                className="pill-input"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmName()}
                placeholder="Which team is this for?"
              />
              <div className="paper-size-toggle">
                <span className="subhead">Demo mode</span>
                <button
                  type="button"
                  className={`toggle-pill${demoModeInput ? " toggle-pill--on" : ""}`}
                  onClick={() => setDemoModeInput(true)}
                >
                  On
                </button>
                <button
                  type="button"
                  className={`toggle-pill${!demoModeInput ? " toggle-pill--on" : ""}`}
                  onClick={() => setDemoModeInput(false)}
                >
                  Off
                </button>
              </div>
            </>
          )}
          <button
            className="btn btn--primary"
            onClick={confirmName}
            disabled={!nameInput.trim() || (isFacilitator && !teamNameInput.trim())}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <SessionApp
      room={room}
      myId={myId}
      myName={myName}
      isFacilitator={isFacilitator}
      teamName={teamName}
      demoMode={demoMode}
    />
  );
}

function SessionApp({
  room,
  myId,
  myName,
  isFacilitator,
  teamName,
  demoMode,
}: {
  room: string;
  myId: string;
  myName: string;
  isFacilitator: boolean;
  teamName: string;
  demoMode: boolean;
}) {
  const { state, wsStatus, sendAction } = useSession({ room, myId, myName, isFacilitator, teamName, demoMode });

  const [synthLoading, setSynthLoading] = useState(false);
  const [synthError, setSynthError] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [reviseLoading, setReviseLoading] = useState(false);
  const [reviseError, setReviseError] = useState<string | null>(null);

  async function handleSynthesize() {
    if (!state) return;
    if (state.demoMode) {
      sendAction({ kind: "setTopics", topics: DEMO_TOPICS });
      return;
    }
    setSynthLoading(true);
    setSynthError(null);
    try {
      const { topics } = await synthesizeTopics({
        participants: state.participants.map((p) => ({ id: p.id, name: p.name })),
        questions: ROUND1_PROMPTS.map((q) => ({ key: q.key, text: q.text })),
        answers: state.round1.answers,
        numTopics: NUM_TOPICS,
      });
      sendAction({ kind: "setTopics", topics });
    } catch {
      setSynthError("Could not synthesize — try again.");
    } finally {
      setSynthLoading(false);
    }
  }

  async function handleDraftPrinciples() {
    if (!state || !state.topics) return;
    if (state.demoMode) {
      sendAction({ kind: "draftPrinciples", principles: DEMO_PRINCIPLES });
      return;
    }
    setDraftLoading(true);
    setDraftError(null);
    try {
      const pickCounts: Record<string, number> = {};
      const commentsByTopic: Record<string, string[]> = {};
      for (const sub of Object.values(state.round2.submissions)) {
        for (const topicId of sub.picks) {
          pickCounts[topicId] = (pickCounts[topicId] ?? 0) + 1;
          const comment = sub.comments[topicId];
          if (comment) commentsByTopic[topicId] = [...(commentsByTopic[topicId] ?? []), comment];
        }
      }
      const { principles } = await draftPrinciples({
        topics: state.topics,
        participantCount: state.participants.length,
        pickCounts,
        commentsByTopic,
        numPrinciples: NUM_PRINCIPLES,
      });
      sendAction({ kind: "draftPrinciples", principles });
    } catch {
      setDraftError("Could not synthesize — try again.");
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleRevise() {
    if (!state || !state.principles) return;
    if (state.demoMode) {
      sendAction({ kind: "revisePrinciples", principles: demoRevise(state.principles) });
      return;
    }
    setReviseLoading(true);
    setReviseError(null);
    try {
      const { principles } = await revisePrinciples({
        principles: state.principles,
        commentsByPrincipleId: state.comments,
      });
      sendAction({ kind: "revisePrinciples", principles });
    } catch {
      setReviseError("Could not revise — try again.");
    } finally {
      setReviseLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <AppBar
        myName={myName}
        isFacilitator={isFacilitator}
        participantCount={state?.participants.length ?? 1}
        demoMode={state?.demoMode ?? false}
      />

      {!state ? (
        <div className="center-column">
          <p className="subhead">
            {wsStatus === "connecting"
              ? "Connecting to the room…"
              : wsStatus === "closed"
                ? "Disconnected — is the relay server running?"
                : "Connected — waiting for session data…"}
          </p>
        </div>
      ) : state.phase === "lobby" ? (
        <Lobby state={state} isFacilitator={isFacilitator} myId={myId} roomCode={room} sendAction={sendAction} />
      ) : state.phase === "round1" ? (
        <Round1
          state={state}
          isFacilitator={isFacilitator}
          myId={myId}
          myName={myName}
          sendAction={sendAction}
          onSynthesize={handleSynthesize}
          synthLoading={synthLoading}
          synthError={synthError}
        />
      ) : state.phase === "synth1" ? (
        <TopicSynthesis
          state={state}
          isFacilitator={isFacilitator}
          onContinue={() => sendAction({ kind: "setPhase", phase: "round2" })}
        />
      ) : state.phase === "round2" ? (
        <Round2
          state={state}
          isFacilitator={isFacilitator}
          myId={myId}
          myName={myName}
          sendAction={sendAction}
          onDraftPrinciples={handleDraftPrinciples}
          draftLoading={draftLoading}
          draftError={draftError}
        />
      ) : state.phase === "poster" || state.phase === "comments" ? (
        <Poster
          state={state}
          isFacilitator={isFacilitator}
          myName={myName}
          sendAction={sendAction}
          onRevise={handleRevise}
          reviseLoading={reviseLoading}
          reviseError={reviseError}
        />
      ) : state.phase === "round3" ? (
        <Round3 state={state} isFacilitator={isFacilitator} myId={myId} myName={myName} sendAction={sendAction} />
      ) : state.phase === "final" ? (
        <FinalPoster state={state} isFacilitator={isFacilitator} sendAction={sendAction} />
      ) : null}
    </div>
  );
}
