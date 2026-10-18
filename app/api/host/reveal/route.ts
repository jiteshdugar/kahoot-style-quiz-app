import { getHostGame } from "@/lib/host";
import { tally } from "@/lib/scoring";
import { json, supabaseAdmin } from "@/lib/supabase/server";

/** Reveals the correct answer once time is up, or as soon as every player has answered. */
export async function POST(req: Request) {
  const { pin, token } = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();
  const game = await getHostGame(sb, pin, token);
  if (!game) return json({ error: "Not allowed" }, 403);
  if (game.state !== "question" || !game.public_question) return json({ error: "No open question" }, 409);

  const [{ data: answers }, { count: players }, { data: q }] = await Promise.all([
    sb.from("answers").select("choice").eq("game_id", game.id).eq("q_idx", game.q_index),
    sb.from("players").select("id", { count: "exact", head: true }).eq("game_id", game.id),
    sb.from("game_questions").select("correct").eq("game_id", game.id).eq("idx", game.q_index).single(),
  ]);
  if (!q) return json({ error: "Question missing" }, 500);

  const timeUp = !!game.question_ends_at && Date.now() >= new Date(game.question_ends_at).getTime();
  const allIn = (answers?.length ?? 0) >= (players ?? 0);
  if (!timeUp && !allIn) return json({ error: "Question still open" }, 409);

  const reveal = {
    correct: q.correct,
    counts: tally((answers ?? []).map((a) => a.choice), game.public_question.options.length),
  };
  const { error } = await sb
    .from("games")
    .update({ state: "reveal", reveal })
    .eq("id", game.id)
    .eq("state", "question"); // idempotent if two reveal calls race
  if (error) return json({ error: "Could not reveal" }, 500);
  return json({ ok: true });
}
