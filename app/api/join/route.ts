import { json, supabaseAdmin } from "@/lib/supabase/server";
import { validateName } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = validateName(body.name);
  if (!name) return json({ error: "Enter a nickname (1-20 characters)" }, 400);
  if (typeof body.pin !== "string") return json({ error: "Enter a game PIN" }, 400);

  const sb = supabaseAdmin();
  const { data: game } = await sb.from("games").select("id,state").eq("pin", body.pin).maybeSingle();
  if (!game) return json({ error: "No game with that PIN" }, 404);
  if (game.state !== "lobby") return json({ error: "That game has already started" }, 409);

  const { data: player, error } = await sb
    .from("players")
    .insert({ game_id: game.id, name })
    .select("id,name")
    .single();
  if (error?.code === "23505") return json({ error: "That nickname is taken" }, 409);
  if (error || !player) return json({ error: "Could not join" }, 500);
  return json({ playerId: player.id, name: player.name });
}
