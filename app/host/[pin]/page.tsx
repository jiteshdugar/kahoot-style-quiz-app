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
      <main className="wrap stack" style={{ textAlign: "center" }}>
        <p className="muted">{game.title} · join at <b>{joinUrl.replace(/^https?:\/\//, "").replace(/\?.*/, "")}</b> with PIN</p>
        <div className="pin">{pin}</div>
        <div className="chips" style={{ justifyContent: "center" }}>
          {players.length === 0 && <span className="muted">Waiting for players…</span>}
          {players.map((p) => <span key={p.id} className="chip">{p.name}</span>)}
        </div>
        <button className="btn big" disabled={players.length === 0} onClick={next}>Start ({players.length} joined)</button>
        {error && <div className="error">{error}</div>}
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
          <span className="chip">Question {q.idx + 1}/{game.total_questions}</span>
          <span className="chip">{answered.length > 0 || game.state === "question" ? `${reveal ? shown.reduce((a, b) => a + b, 0) : answered.length} of ${players.length} answered` : ""}</span>
          {game.state === "question" && <div className="timer">{Math.ceil(left / 1000)}</div>}
        </div>
        <div className="q-text">{q.text}</div>
        <div className="bars">
          {q.options.map((o, i) => (
            <div key={i} className={`bar opt-${i} ${reveal && reveal.correct !== i ? "dim" : ""}`} style={{ height: `${Math.max(14, (shown[i] / max) * 100)}%` }}>
              <span className="n">{shown[i]}</span>
              <span>{SHAPES[i]} {o}{reveal && reveal.correct === i ? " ✔" : ""}</span>
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
    <main className="wrap stack" style={{ textAlign: "center" }}>
      <h1>🏆 Final results</h1>
      <div className="podium">
        {second && <div className="p2">🥈<br />{second.name}<br />{second.score}</div>}
        {first && <div className="p1">🥇<br />{first.name}<br />{first.score}</div>}
        {third && <div className="p3">🥉<br />{third.name}<br />{third.score}</div>}
      </div>
      <Leaderboard players={ranked} />
      <a className="btn light big" href="/host" style={{ textDecoration: "none", display: "inline-block" }}>Host another quiz</a>
    </main>
  );
}

function Leaderboard({ players }: { players: Player[] }) {
  return (
    <ol className="lb">
      {players.map((p, i) => (
        <li key={p.id}><span>{i + 1}. {p.name}</span><span>{p.score}</span></li>
      ))}
    </ol>
  );
}
