import { getHostGame } from "@/lib/host";
import { json, supabaseAdmin } from "@/lib/supabase/server";

/** Starts the game from the lobby, or advances from a reveal to the next question / the podium. */
export async function POST(req: Request) {
  const { pin, token } = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();
  const game = await getHostGame(sb, pin, token);
  if (!game) return json({ error: "Not allowed" }, 403);
  if (game.state === "question") return json({ error: "Question still in progress" }, 409);
  if (game.state === "finished") return json({ error: "Game is over" }, 409);

  if (game.state === "lobby") {
    const { count } = await sb.from("players").select("id", { count: "exact", head: true }).eq("game_id", game.id);
    if (!count) return json({ error: "Wait for at least one player to join" }, 409);
  }

  const next = game.q_index + 1;
  if (next >= game.total_questions) {
    await sb.from("games").update({ state: "finished", public_question: null, question_ends_at: null }).eq("id", game.id);
    return json({ ok: true, state: "finished" });
  }

  const { data: q } = await sb
    .from("game_questions")
    .select("idx,text,options,seconds")
    .eq("game_id", game.id)
    .eq("idx", next)
    .single();
  if (!q) return json({ error: "Question missing" }, 500);

  const endsAt = new Date(Date.now() + q.seconds * 1000).toISOString();
  const { error } = await sb
    .from("games")
    .update({ state: "question", q_index: next, public_question: q, reveal: null, question_ends_at: endsAt })
    .eq("id", game.id);
  if (error) return json({ error: "Could not advance" }, 500);
  return json({ ok: true, state: "question" });
}
