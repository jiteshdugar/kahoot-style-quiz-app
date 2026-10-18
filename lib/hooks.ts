"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/browser";
import type { Game, Player } from "./types";

const GAME_COLS = "id,pin,title,state,q_index,total_questions,question_ends_at,public_question,reveal";

/** Loads the game by PIN and keeps it live via Supabase Realtime (Postgres Changes). */
export function useGame(pin: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    const load = async () => {
      const { data } = await sb.from("games").select(GAME_COLS).eq("pin", pin).maybeSingle();
      if (data) setGame(data as Game);
      else setMissing(true);
    };
    const channel = sb
      .channel(`game-${pin}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `pin=eq.${pin}` }, (p) =>
        setGame(p.new as Game),
      )
      // Reload once subscribed so nothing is missed between the first fetch and the subscription.
      .subscribe((status) => status === "SUBSCRIBED" && load());
    load();
    return () => {
      sb.removeChannel(channel);
    };
  }, [pin]);

  return { game, missing };
}

/** Live player list (joins and score changes) for a game. */
export function usePlayers(gameId: string | undefined) {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!gameId) return;
    const sb = supabaseBrowser();
    const load = async () => {
      const { data } = await sb.from("players").select("id,game_id,name,score").eq("game_id", gameId);
      if (data) setPlayers(data as Player[]);
    };
    const channel = sb
      .channel(`players-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, (p) => {
        if (p.eventType === "DELETE") {
          setPlayers((cur) => cur.filter((x) => x.id !== (p.old as Player).id));
        } else {
          const row = p.new as Player;
          setPlayers((cur) => [...cur.filter((x) => x.id !== row.id), row]);
        }
      })
      .subscribe((status) => status === "SUBSCRIBED" && load());
    load();
    return () => {
      sb.removeChannel(channel);
    };
  }, [gameId]);

  return players;
}

/** Milliseconds left until `endsAt` (ISO string), ticking every 100ms. */
export function useCountdown(endsAt: string | null | undefined) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!endsAt) return setMs(0);
    const tick = () => setMs(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt]);
  return ms;
}

export async function post<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
    return value;
  } catch {
    return null;
  }
}
