import { getHostGame } from "@/lib/host";
import { tally } from "@/lib/scoring";
import { json, supabaseAdmin } from "@/lib/supabase/server";

/** Host-only snapshot of live answers, used on dashboard load/refresh (live updates come via Broadcast). */
export async function POST(req: Request) {
  const { pin, token } = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();
  const game = await getHostGame(sb, pin, token);
  if (!game) return json({ error: "Not allowed" }, 403);

  const { data: answers } = await sb
    .from("answers")
    .select("player_id,choice")
    .eq("game_id", game.id)
    .eq("q_idx", game.q_index);
  const optionCount = game.public_question?.options.length ?? 4;
  return json({
    qIdx: game.q_index,
    counts: tally((answers ?? []).map((a) => a.choice), optionCount),
    answered: (answers ?? []).map((a) => a.player_id),
  });
}
