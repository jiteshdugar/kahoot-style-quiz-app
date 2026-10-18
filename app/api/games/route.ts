import { randomBytes, randomInt } from "node:crypto";
import templates from "@/data/templates.json";
import { json, supabaseAdmin } from "@/lib/supabase/server";
import { validateQuiz } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid request" }, 400);

  // Either launch a shipped AI template (optionally edited by the host) or a custom quiz.
  let quizInput: unknown = body.quiz;
  if (!quizInput && typeof body.templateId === "string") {
    const t = templates.find((x) => x.id === body.templateId);
    if (!t) return json({ error: "Unknown template" }, 404);
    quizInput = { title: t.title, questions: t.questions };
  }
  const quiz = validateQuiz(quizInput);
  if (typeof quiz === "string") return json({ error: quiz }, 400);

  const sb = supabaseAdmin();
  let game: { id: string; pin: string } | null = null;
  for (let attempt = 0; attempt < 5 && !game; attempt++) {
    const pin = String(randomInt(100000, 1000000));
    const { data, error } = await sb
      .from("games")
      .insert({ pin, title: quiz.title, total_questions: quiz.questions.length })
      .select("id,pin")
      .single();
    if (data) game = data;
    else if (error?.code !== "23505") return json({ error: "Could not create game" }, 500);
  }
  if (!game) return json({ error: "Could not allocate a PIN, try again" }, 500);

  const hostToken = randomBytes(24).toString("hex");
  const [s, q] = await Promise.all([
    sb.from("game_secrets").insert({ game_id: game.id, host_token: hostToken }),
    sb.from("game_questions").insert(quiz.questions.map((x, idx) => ({ game_id: game!.id, idx, ...x }))),
  ]);
  if (s.error || q.error) {
    await sb.from("games").delete().eq("id", game.id);
    return json({ error: "Could not save quiz" }, 500);
  }
  return json({ pin: game.pin, hostToken });
}
