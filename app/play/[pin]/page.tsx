"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { post, store, useCountdown, useGame, usePlayers } from "@/lib/hooks";

const SHAPES = ["▲", "◆", "●", "■"];

export default function PlayPage() {
  const { pin } = useParams<{ pin: string }>();
  const router = useRouter();
  const { game, missing } = useGame(pin);
  const players = usePlayers(game?.id);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ q: number; choice: number } | null>(null);
  const [error, setError] = useState("");
  const left = useCountdown(game?.state === "question" ? game.question_ends_at : null);

  useEffect(() => {
    const id = store(`player:${pin}`);
    if (!id) router.replace(`/?pin=${pin}`);
    else setPlayerId(id);
  }, [pin, router]);

  if (missing) return <Shell><h2>Game not found</h2></Shell>;
  if (!game || !playerId) return <Shell><p className="muted">Connecting…</p></Shell>;

  const ranked = [...players].sort((a, b) => b.score - a.score);
  const me = ranked.find((p) => p.id === playerId);
  const rank = ranked.findIndex((p) => p.id === playerId) + 1;
  const myPick = picked && picked.q === game.q_index ? picked.choice : null;

  async function answer(choice: number) {
    if (myPick !== null) return;
    setPicked({ q: game!.q_index, choice });
    setError("");
    const { ok, data } = await post("/api/answer", { playerId, choice });
    if (!ok && data.error !== "Already answered") {
      setPicked(null);
      setError(data.error ?? "Could not send answer");
    }
  }

  if (game.state === "lobby") {
    return (
      <Shell>
        <h2>You're in{me ? `, ${me.name}` : ""}!</h2>
        <p className="muted">Waiting for the host to start… ({players.length} joined)</p>
      </Shell>
    );
  }

  if (game.state === "question" && game.public_question) {
    const q = game.public_question;
    return (
      <main className="wrap stack">
        <div className="row between">
          <span className="chip">Q{q.idx + 1}/{game.total_questions}</span>
          <div className="timer" style={{ width: 60, height: 60, fontSize: "1.6rem" }}>{Math.ceil(left / 1000)}</div>
        </div>
        <div className="q-text">{q.text}</div>
        {myPick !== null ? (
          <Shell inline><h2>Answer locked in ✔</h2><p className="muted">Waiting for the others…</p></Shell>
        ) : (
          <div className="answers">
            {q.options.map((o, i) => (
              <button key={i} className={`answer opt-${i}`} disabled={left <= 0} onClick={() => answer(i)}>
                <span className="shape">{SHAPES[i]}</span>
                {o}
              </button>
            ))}
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </main>
    );
  }

  if (game.state === "reveal" && game.reveal) {
    const right = myPick === game.reveal.correct;
    return (
      <Shell>
        <div className="verdict">{myPick === null ? "⏱ Too slow" : right ? "✅ Correct!" : "❌ Not quite"}</div>
        <p>Score: <b>{me?.score ?? 0}</b> · Rank <b>#{rank || "-"}</b> of {players.length}</p>
        <p className="muted">Look at the big screen…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h2>{rank === 1 ? "🏆 You won!" : rank > 0 && rank <= 3 ? "🎉 Podium finish!" : "Game over"}</h2>
      <p>Final rank <b>#{rank || "-"}</b> of {players.length} · <b>{me?.score ?? 0}</b> pts</p>
    </Shell>
  );
}

function Shell({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  const body = <div className="stack" style={{ textAlign: "center" }}>{children}</div>;
  return inline ? body : <main className="center">{body}</main>;
}
