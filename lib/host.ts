import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const GAME_COLS = "id,pin,title,state,q_index,total_questions,question_ends_at,public_question,reveal";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Loads a game by PIN and checks the host token. Returns null when either is wrong. */
export async function getHostGame(sb: SupabaseClient, pin: unknown, token: unknown) {
  if (typeof pin !== "string" || typeof token !== "string") return null;
  const { data: game } = await sb.from("games").select(GAME_COLS).eq("pin", pin).maybeSingle();
  if (!game) return null;
  const { data: secret } = await sb.from("game_secrets").select("host_token").eq("game_id", game.id).maybeSingle();
  if (!secret || !safeEqual(secret.host_token, token)) return null;
  return game;
}

export function hostTopic(pin: string) {
  return `game-host-${pin}`;
}
