"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { post, store, useCountdown, useGame, usePlayers } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AnswerEvent, Player } from "@/lib/types";

const SHAPES = ["▲", "◆", "●", "■"];

export default function HostGame() {
  const { pin } = useParams<{ pin: string }>();
  const { game, missing } = useGame(pin);
  const players = usePlayers(game?.id);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [counts, setCounts] = useState<number[]>([]);
  const [answered, setAnswered] = useState<string[]>([]);
  const [error, setError] = useState("");
  const revealing = useRef<number>(-1);
  const left = useCountdown(game?.state === "question" ? game.question_ends_at : null);

  useEffect(() => setToken(store(`host:${pin}`)), [pin]);

  const qIdx = game?.q_index ?? -1;
  const state = game?.state;

  // Live answers arrive over Supabase Realtime Broadcast; fetch a snapshot first (covers refreshes).
  useEffect(() => {
    if (!token || state !== "question") return;
    setCounts([]);
    setAnswered([]);
    const sb = supabaseBrowser();
    const apply = (e: Pick<AnswerEvent, "qIdx" | "counts" | "answered">) => {
      if (e.qIdx !== qIdx) return;
      setCounts(e.counts);
      setAnswered(e.answered);
    };
    const ch = sb
      .channel(`game-host-${pin}`)
      .on("broadcast", { event: "answer" }, ({ payload }) => apply(payload as AnswerEvent))
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        const { ok, data } = await post<{ qIdx: number; counts: number[]; answered: string[] }>("/api/host/state", { pin, token });
        if (ok) apply(data);
      });
    return () => {
      sb.removeChannel(ch);
    };
  }, [pin, token, state, qIdx]);

  // Auto-reveal when the timer ends or everyone has answered. The server re-checks both rules.
  const allIn = players.length > 0 && answered.length >= players.length;
  useEffect(() => {
    if (!token || state !== "question") return;
    if (!(left <= 0 || allIn) || revealing.current === qIdx) return;
    revealing.current = qIdx;
    (async () => {
      for (let i = 0; i < 5; i++) {
        const { ok } = await post("/api/host/reveal", { pin, token });
        if (ok) return;
        await new Promise((r) => setTimeout(r, 700)); // clock skew: server may think time isn't up yet
      }
      revealing.current = -1;
    })();
  }, [left, allIn, token, state, qIdx, pin]);

  async function next() {
    setError("");
    const { ok, data } = await post("/api/host/next", { pin, token });
    if (!ok) setError(data.error ?? "Could not continue");
  }

  if (missing) return <main className="center"><h2>Game not found</h2></main>;
  if (!game || token === undefined) return <main className="center"><p className="muted">Loading…</p></main>;
  if (!token) return <main className="center"><h2>This browser isn't the host of game {pin}</h2></main>;

  const ranked = [...players].sort((a, b) => b.score - a.score);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/?pin=${pin}` : "";

  if (game.state === "lobby") {
    return (
      <main className="wrap lobby">
        <div>
          <h2>{game.title}</h2>
          <p className="pin-label">Go to <b>{joinUrl.replace(/^https?:\/\//, "").replace(/\?.*/, "")}</b> and enter this PIN</p>
          <div className="pin" aria-label={`Game PIN ${pin}`}>
            {pin.split("").map((d, i) => <span key={i}>{d}</span>)}
          </div>
        </div>
        <div className="stack">
          <h3>{players.length === 0 ? "Waiting for players" : `${players.length} ${players.length === 1 ? "player" : "players"} in`}</h3>
          <div className="chips">
            {players.map((p) => <span key={p.id} className="chip">{p.name}</span>)}
          </div>
        </div>
        <div>
          <button className="btn big" disabled={players.length === 0} onClick={next}>Start the quiz</button>
          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </main>
    );
  }

  if ((game.state === "question" || game.state === "reveal") && game.public_question) {
    const q = game.public_question;
    const reveal = game.state === "reveal" ? game.reveal : null;
    const shown = reveal ? reveal.counts : q.options.map((_, i) => counts[i] ?? 0);
    const max = Math.max(1, ...shown);
    return (
      <main className="wrap stack">
        <div className="row between">
          <span className="q-count">Question {q.idx + 1} of {game.total_questions}</span>
          <span className="chip">{reveal ? shown.reduce((a, b) => a + b, 0) : answered.length} of {players.length} answered</span>
        </div>
        {game.state === "question" && (
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <div className={`clock ${left < 5000 ? "low" : ""}`} style={{ flex: 1 }}>
              <i style={{ width: `${Math.min(100, (left / (q.seconds * 1000)) * 100)}%` }} />
            </div>
            <span className="secs">{Math.ceil(left / 1000)}</span>
          </div>
        )}
        <div className="q-text">{q.text}</div>
        <div className="bars">
          {q.options.map((o, i) => (
            <div key={i} className={`bar-col ${reveal && reveal.correct !== i ? "dim" : ""}`}>
              <div className="bar-track">
                <div className={`bar opt-${i}`} style={{ height: `${Math.max(12, (shown[i] / max) * 100)}%` }}>
                  <span className="n">{shown[i]}</span>
                </div>
              </div>
              <div className={`bar-label opt-${i}`}>
                <span aria-hidden>{SHAPES[i]}</span> {o}{reveal && reveal.correct === i ? " (correct)" : ""}
              </div>
            </div>
          ))}
        </div>
        {game.state === "question" && (
          <div className="chips">
            {players.map((p) => <span key={p.id} className={`chip ${answered.includes(p.id) ? "done" : ""}`}>{p.name}{answered.includes(p.id) ? " ✔" : ""}</span>)}
          </div>
        )}
        {reveal && (
          <>
            <Leaderboard players={ranked.slice(0, 5)} />
            <button className="btn big" onClick={next}>{game.q_index + 1 >= game.total_questions ? "Show podium" : "Next question"}</button>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </main>
    );
  }

  const [first, second, third] = ranked;
  return (
    <main className="wrap stack">
      <h1>Final results</h1>
      <div className="podium">
        {second && <div className="p2"><span className="medal">🥈</span>{second.name}<span className="pts">{second.score}</span></div>}
        {first && <div className="p1"><span className="medal">🥇</span>{first.name}<span className="pts">{first.score}</span></div>}
        {third && <div className="p3"><span className="medal">🥉</span>{third.name}<span className="pts">{third.score}</span></div>}
      </div>
      <Leaderboard players={ranked} />
      <a className="btn big" href="/host" style={{ textDecoration: "none", display: "inline-block", color: "#fff" }}>Host another quiz</a>
    </main>
  );
}

function Leaderboard({ players }: { players: Player[] }) {
  return (
    <ol className="lb">
      {players.map((p, i) => (
        <li key={p.id}><span>{i + 1}. {p.name}</span><b>{p.score}</b></li>
      ))}
    </ol>
  );
}
