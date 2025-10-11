/**
 * Audit utilities for working with actor identifiers.
 *
 * During the Supabase → Convex migration we stored string-based `created_by`
 * fields that could hold either an email address (legacy), the literal value
 * `"system"` (for automated jobs), or a Convex user ID. The helpers in this
 * module make it easy to encode the current Convex identity and decode legacy
 * values in a consistent way.
 */

import type { Id } from "../_generated/dataModel";

export const SYSTEM_ACTOR = "system";

type ActorToken = string | null | undefined;

export type ResolvedActor =
  | { type: "unknown" }
  | { type: "system" }
  | { type: "legacy-email"; email: string }
  | { type: "user"; userId: Id<"users"> };

/**
 * Encode a Convex user ID so it can be stored in legacy string fields.
 */
export function encodeActorId(userId: Id<"users">): string {
  return userId;
}

/**
 * Resolve a stored actor token into a richer structure that callers can use
 * to hydrate display information or perform follow-up lookups.
 */
export function resolveActor(token: ActorToken): ResolvedActor {
  if (!token) {
    return { type: "unknown" };
  }

  if (token === SYSTEM_ACTOR) {
    return { type: "system" };
  }

  if (token.includes("@")) {
    return { type: "legacy-email", email: token };
  }

  return { type: "user", userId: token as Id<"users"> };
}

/**
 * Convenience helper that returns the Convex user ID if it is encoded in the
 * token, otherwise `undefined`.
 */
export function tryGetActorId(token: ActorToken): Id<"users"> | undefined {
  const resolved = resolveActor(token);
  return resolved.type === "user" ? resolved.userId : undefined;
}
