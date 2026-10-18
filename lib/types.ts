export type QuizQuestion = {
  text: string;
  options: string[];
  correct: number;
  seconds: number;
};

export type Template = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  questions: QuizQuestion[];
};

export type GameState = "lobby" | "question" | "reveal" | "finished";

export type PublicQuestion = {
  idx: number;
  text: string;
  options: string[];
  seconds: number;
};

export type Reveal = { correct: number; counts: number[] };

export type Game = {
  id: string;
  pin: string;
  title: string;
  state: GameState;
  q_index: number;
  total_questions: number;
  question_ends_at: string | null;
  public_question: PublicQuestion | null;
  reveal: Reveal | null;
};

export type Player = { id: string; game_id: string; name: string; score: number };

export type AnswerEvent = { playerId: string; name: string; qIdx: number; counts: number[]; answered: string[] };
