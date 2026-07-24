import { createClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/** Server-side client. Bypasses RLS — never import this into a client component. */
export function adminDb() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
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
