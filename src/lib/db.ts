import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/**
 * One client for the process, not one per call. It holds no session (see
 * `persistSession`), so there is nothing request-scoped in it to leak between
 * players — and building a fresh one on every query was costing a setup round
 * on the critical path of every page render.
 */
let client: SupabaseClient | null = null;

/** Server-side client. Bypasses RLS — never import this into a client component. */
export function adminDb(): SupabaseClient {
  client ??= createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  return client;
}

export function publicUrl(storagePath: string): string {
  const base = required("NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/storage/v1/object/public/${storagePath}`;
}

export type Player = {
  id: string;
  name: string;
  emoji: string;
  is_target: boolean;
  reference_path: string | null;
};

export type GameState = {
  meter: number;
  threshold: number;
  shots_owed: number;
  shots_taken: number;
  round: number;
};

export type Photo = {
  id: string;
  photographer_id: string;
  subject_id: string;
  storage_path: string;
  /** Feed-sized copy of `storage_path`. Null for photos taken before thumbs. */
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  score: number;
  funniness: number;
  candidness: number;
  stealth_multiplier: number;
  caption: string | null;
  tags: string[];
  verified: boolean;
  rejected_reason: string | null;
  created_at: string;
};
