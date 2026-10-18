/** 1000 points for an instant correct answer, down to 500 at the buzzer. Wrong = 0. */
export function scoreAnswer(correct: boolean, msRemaining: number, totalSeconds: number): number {
  if (!correct) return 0;
  const total = totalSeconds * 1000;
  const ratio = Math.min(1, Math.max(0, msRemaining / total));
  return Math.round(1000 * (0.5 + 0.5 * ratio));
}

export function tally(choices: number[], optionCount: number): number[] {
  const counts = new Array(optionCount).fill(0);
  for (const c of choices) if (c >= 0 && c < optionCount) counts[c]++;
  return counts;
}
