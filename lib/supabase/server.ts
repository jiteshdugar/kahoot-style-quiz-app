import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server only: bypasses RLS. */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Send a Realtime Broadcast from the server over the REST endpoint (no websocket needed on Vercel). */
export async function broadcast(topic: string, event: string, payload: unknown) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
    });
  } catch {
    // Live answers are best-effort; the host dashboard can also refetch /api/host/state.
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
