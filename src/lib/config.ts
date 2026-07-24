/** Game tuning. All the knobs worth turning the night of, in one place. */
export const RULES = {
  /** Raw model score is scaled by this before hitting the meter. */
  POINT_SCALE: 0.5,
  /** Candidness (0-100) contributes up to this many bonus points. */
  CANDID_BONUS: 40,
  /** No photo of the target for this long => cold-trail bonus. */
  COLD_TRAIL_MINUTES: 10,
  COLD_TRAIL_MULTIPLIER: 1.5,
  /** Another photo landed this recently => damped, to stop burst-spamming. */
  SPAM_WINDOW_MINUTES: 2,
  SPAM_MULTIPLIER: 0.6,
  /** When Matt catches someone off guard, that person drinks too. */
  MATT_REVENGE_DRINKS: true,
  /** Matt's own photos claw back this fraction of their value. */
  COUNTER_ATTACK_RATE: 1.0,
  /**
   * How hard the judge thinks about a rig. Rigs turn on counting people, arms
   * and phones, which a glance gets wrong — at "low" the judge read a held-up
   * three-and-four as eight. Drop to "medium" if the wait at the bar is worse
   * than the odd miscount.
   */
  RIG_JUDGE_EFFORT: "high",
  /**
   * How many times a rig is judged before the majority decides. Odd numbers
   * only, or there's no majority. 1 disables voting; 5 buys a little more
   * certainty for another ~1.5¢ on the handful of rigs in a night.
   */
  RIG_VOTES: 3,
} as const;

export const SESSION_COOKIE = "byematt_session";
export const STORAGE_BUCKET = "captures";

/**
 * The groom's display name — shown on the sign-in button and in the feed.
 * Purely a label: it is never matched against anything anyone types, so he
 * can't break the game by entering something unexpected.
 */
export const targetName = () => (process.env.TARGET_NAME ?? "").trim() || "Matt";
