"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import templates from "@/data/templates.json";
import { post, store } from "@/lib/hooks";
import type { QuizQuestion } from "@/lib/types";

type Draft = { title: string; questions: QuizQuestion[] };

const blankQuestion = (): QuizQuestion => ({ text: "", options: ["", "", "", ""], correct: 0, seconds: 20 });

export default function HostHome() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  async function launch(body: object) {
    setBusy(true);
    setError("");
    const { ok, data } = await post<{ pin: string; hostToken: string }>("/api/games", body);
    if (!ok) {
      setError(data.error ?? "Could not create game");
      setBusy(false);
      return;
    }
    store(`host:${data.pin}`, data.hostToken);
    router.push(`/host/${data.pin}`);
  }

  if (draft) {
    return <Editor draft={draft} setDraft={setDraft} busy={busy} error={error} onLaunch={() => launch({ quiz: draft })} onCancel={() => setDraft(null)} />;
  }

  return (
    <main className="wrap stack">
      <div className="row between">
        <h1>Pick a quiz</h1>
        <Link href="/">Join a game instead</Link>
      </div>
      <p className="muted">Every template is about AI and has 5 questions. Launch it as is, or edit it first.</p>
      {error && <div className="error">{error}</div>}
      <div className="grid">
        {templates.map((t) => (
          <div key={t.id} className="card tpl">
            <div className="emoji">{t.emoji}</div>
            <h3>{t.title}</h3>
            <p className="muted">{t.description}</p>
            <div className="row">
              <button className="btn" disabled={busy} onClick={() => launch({ templateId: t.id })}>Launch</button>
              <button className="btn light" disabled={busy} onClick={() => setDraft({ title: t.title, questions: structuredClone(t.questions) })}>
                Edit first
              </button>
            </div>
          </div>
        ))}
        <div className="card tpl">
          <div className="emoji">➕</div>
          <h3>Blank quiz</h3>
          <p className="muted">Write your own questions from scratch.</p>
          <div className="row">
            <button className="btn light" onClick={() => setDraft({ title: "My quiz", questions: [blankQuestion()] })}>Start blank</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Editor({ draft, setDraft, busy, error, onLaunch, onCancel }: {
  draft: Draft; setDraft: (d: Draft) => void; busy: boolean; error: string; onLaunch: () => void; onCancel: () => void;
}) {
  const setQ = (i: number, patch: Partial<QuizQuestion>) =>
    setDraft({ ...draft, questions: draft.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <main className="wrap stack">
      <h1>Edit quiz</h1>
      <div className="card stack">
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Quiz title" />
        {draft.questions.map((q, i) => (
          <div key={i} className="editor-q stack">
            <div className="row between">
              <b>Question {i + 1}</b>
              {draft.questions.length > 1 && (
                <button className="btn danger" onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })}>Remove</button>
              )}
            </div>
            <input value={q.text} placeholder="Question text" onChange={(e) => setQ(i, { text: e.target.value })} />
            <div className="opts">
              {q.options.map((o, k) => (
                <label key={k} className="opt-row">
                  <input type="radio" name={`c${i}`} checked={q.correct === k} onChange={() => setQ(i, { correct: k })} aria-label={`Option ${k + 1} is correct`} />
                  <input value={o} placeholder={`Option ${k + 1}`} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="row">
          {draft.questions.length < 5 && (
            <button className="btn light" onClick={() => setDraft({ ...draft, questions: [...draft.questions, blankQuestion()] })}>Add question ({draft.questions.length}/5)</button>
          )}
        </div>
        {error && <div className="error">{error}</div>}
        <div className="row">
          <button className="btn big" disabled={busy} onClick={onLaunch}>{busy ? "Launching…" : "Launch quiz"}</button>
          <button className="btn light" onClick={onCancel}>Back to templates</button>
        </div>
      </div>
    </main>
  );
}
