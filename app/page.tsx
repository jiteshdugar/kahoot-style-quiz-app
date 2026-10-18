"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { post, store } from "@/lib/hooks";

export default function JoinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pin");
    if (p) setPin(p.replace(/\D/g, "").slice(0, 6));
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, data } = await post<{ playerId: string }>("/api/join", { pin, name });
    if (!ok) {
      setError(data.error ?? "Could not join");
      setBusy(false);
      return;
    }
    store(`player:${pin}`, data.playerId);
    store(`name:${pin}`, name.trim());
    router.push(`/play/${pin}`);
  }

  return (
    <main className="center">
      <div className="stack join">
        <h1>AI Quiz Live</h1>
        <p className="muted">Enter the PIN on the big screen and pick a nickname.</p>
        <form className="card stack" onSubmit={join}>
          <input
            inputMode="numeric"
            placeholder="Game PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-label="Game PIN"
            autoFocus
          />
          <input placeholder="Nickname" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} aria-label="Nickname" />
          <button className="btn big" disabled={busy || pin.length !== 6 || !name.trim()}>
            {busy ? "Joining…" : "Join game"}
          </button>
          {error && <div className="error">{error}</div>}
        </form>
        <p>Running the quiz? <Link href="/host">Host a game</Link></p>
      </div>
    </main>
  );
}
