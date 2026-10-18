import { hostTopic } from "@/lib/host";
import { scoreAnswer, tally } from "@/lib/scoring";
import { broadcast, json, supabaseAdmin } from "@/lib/supabase/server";
import type { AnswerEvent } from "@/lib/types";

const GRACE_MS = 500; // network jitter allowance

export async function POST(req: Request) {
  const { playerId, choice } = await req.json().catch(() => ({}));
  if (typeof playerId !== "string" || !Number.isInteger(choice)) return json({ error: "Invalid answer" }, 400);

  const sb = supabaseAdmin();
  const { data: player } = await sb.from("players").select("id,name,game_id").eq("id", playerId).maybeSingle();
  if (!player) return json({ error: "Unknown player" }, 404);

  const { data: game } = await sb
    .from("games")
    .select("id,pin,state,q_index,question_ends_at,public_question")
    .eq("id", player.game_id)
    .single();
  if (!game || game.state !== "question" || !game.public_question || !game.question_ends_at) {
    return json({ error: "No open question" }, 409);
  }

  const endsAt = new Date(game.question_ends_at).getTime();
  const now = Date.now();
  if (now > endsAt + GRACE_MS) return json({ error: "Time is up" }, 409);
  const optionCount = game.public_question.options.length;
  if (choice < 0 || choice >= optionCount) return json({ error: "Invalid choice" }, 400);

  const { data: q } = await sb
    .from("game_questions")
    .select("correct,seconds")
    .eq("game_id", game.id)
    .eq("idx", game.q_index)
    .single();
  if (!q) return json({ error: "Question missing" }, 500);

  const isCorrect = choice === q.correct;
  const points = scoreAnswer(isCorrect, Math.max(0, endsAt - now), q.seconds);
  const { error } = await sb.from("answers").insert({
    game_id: game.id,
    q_idx: game.q_index,
    player_id: player.id,
    choice,
    is_correct: isCorrect,
    points,
  });
  if (error?.code === "23505") return json({ error: "Already answered" }, 409);
  if (error) return json({ error: "Could not record answer" }, 500);
  if (points > 0) await sb.rpc("add_score", { p_player: player.id, p_points: points });

  // Push live answer stats to the host only (players never see each other's choices).
  const { data: all } = await sb.from("answers").select("player_id,choice").eq("game_id", game.id).eq("q_idx", game.q_index);
  const event: AnswerEvent = {
    playerId: player.id,
    name: player.name,
    qIdx: game.q_index,
    counts: tally((all ?? []).map((a) => a.choice), optionCount),
    answered: (all ?? []).map((a) => a.player_id),
  };
  await broadcast(hostTopic(game.pin), "answer", event);

  // Correctness is withheld until the host reveals, so only acknowledge receipt.
  return json({ ok: true });
}
