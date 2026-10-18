import type { QuizQuestion } from "./types";

export const MAX_QUESTIONS = 5;

export type ValidQuiz = { title: string; questions: QuizQuestion[] };

/** Returns a cleaned quiz or an error string. Enforces 1-5 questions, 2-4 options each. */
export function validateQuiz(input: unknown): ValidQuiz | string {
  if (!input || typeof input !== "object") return "Quiz is missing";
  const { title, questions } = input as { title?: unknown; questions?: unknown };
  if (typeof title !== "string" || !title.trim()) return "Quiz needs a title";
  if (!Array.isArray(questions) || questions.length < 1) return "Add at least 1 question";
  if (questions.length > MAX_QUESTIONS) return `A quiz can have at most ${MAX_QUESTIONS} questions`;

  const clean: QuizQuestion[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] as Partial<QuizQuestion>;
    const n = i + 1;
    if (typeof q.text !== "string" || !q.text.trim()) return `Question ${n} needs text`;
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
      return `Question ${n} needs 2-4 options`;
    }
    const options = q.options.map((o) => (typeof o === "string" ? o.trim() : ""));
    if (options.some((o) => !o)) return `Question ${n} has an empty option`;
    if (!Number.isInteger(q.correct) || (q.correct as number) < 0 || (q.correct as number) >= options.length) {
      return `Question ${n} needs a valid correct answer`;
    }
    const seconds = Number.isFinite(q.seconds) ? Math.min(60, Math.max(5, Math.round(q.seconds as number))) : 20;
    clean.push({ text: q.text.trim().slice(0, 200), options: options.map((o) => o.slice(0, 100)), correct: q.correct as number, seconds });
  }
  return { title: title.trim().slice(0, 80), questions: clean };
}

export function validateName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = name.trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= 20 ? n : null;
}
