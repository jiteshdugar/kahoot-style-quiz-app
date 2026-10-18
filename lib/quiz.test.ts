import { describe, expect, it } from "vitest";
import templates from "../data/templates.json";
import { scoreAnswer, tally } from "./scoring";
import { validateQuiz } from "./validate";

describe("scoring", () => {
  it("gives full points instantly, half at the buzzer, zero when wrong", () => {
    expect(scoreAnswer(true, 20000, 20)).toBe(1000);
    expect(scoreAnswer(true, 0, 20)).toBe(500);
    expect(scoreAnswer(false, 20000, 20)).toBe(0);
  });
  it("tallies choices", () => {
    expect(tally([0, 1, 1, 3], 4)).toEqual([1, 2, 0, 1]);
  });
});

describe("validateQuiz", () => {
  const q = { text: "Q?", options: ["a", "b"], correct: 0, seconds: 10 };
  it("accepts 1-5 questions", () => {
    expect(typeof validateQuiz({ title: "T", questions: [q] })).toBe("object");
  });
  it("rejects 6 questions", () => {
    expect(validateQuiz({ title: "T", questions: Array(6).fill(q) })).toMatch(/at most 5/);
  });
  it("rejects bad correct index", () => {
    expect(validateQuiz({ title: "T", questions: [{ ...q, correct: 2 }] })).toMatch(/correct/);
  });
  it("every shipped template is valid and has exactly 5 questions", () => {
    for (const t of templates) {
      const r = validateQuiz({ title: t.title, questions: t.questions });
      expect(typeof r, t.id).toBe("object");
      expect(t.questions).toHaveLength(5);
    }
  });
});
