/**
 * Migration helpers for bulk profile imports and testing.
 *
 * These are internal mutations/actions invoked via scripts using the Convex
 * admin key. They intentionally bypass user-level auth gates so they should
 * only be executed from trusted tooling (e.g., `scripts/migrate-profiles-to-convex.ts`).
 */

import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { type Id } from "./_generated/dataModel";

type Role =
  | "admin"
  | "fund_director"
  | "pastor"
  | "treasurer"
  | "church_manager"
  | "secretary";

const roleValidator = v.union(
  v.literal("admin"),
  v.literal("fund_director"),
  v.literal("pastor"),
  v.literal("treasurer"),
  v.literal("church_manager"),
  v.literal("secretary"),
);

async function resolveChurchId(
  ctx: MutationCtx,
  supabaseId: number | undefined
): Promise<Id<"churches"> | undefined> {
  if (supabaseId === undefined || supabaseId === null) {
    return undefined;
  }

  const churches = await ctx.db.query("churches").collect();
  const match = churches.find((church) => church.supabase_id === supabaseId);

  return match?._id;
}

async function resolveFundId(
  ctx: MutationCtx,
  supabaseId: number | undefined
): Promise<Id<"funds"> | undefined> {
  if (supabaseId === undefined || supabaseId === null) {
    return undefined;
  }

  const funds = await ctx.db.query("funds").collect();
  const match = funds.find((fund) => fund.supabase_id === supabaseId);

  return match?._id;
}

export const upsertProfile = internalMutation({
  args: {
    email: v.string(),
    role: roleValidator,
    active: v.boolean(),
    user_id: v.optional(v.id("users")),
    full_name: v.optional(v.string()),
    church_supabase_id: v.optional(v.number()),
    fund_supabase_id: v.optional(v.number()),
    created_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const now = Date.now();
    const createdAt = args.created_at ?? now;
    const updatedAt = args.updated_at ?? now;
    const fullName = args.full_name?.trim();

    const churchId = await resolveChurchId(ctx, args.church_supabase_id ?? undefined);
    const fundId = await resolveFundId(ctx, args.fund_supabase_id ?? undefined);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    let userId: Id<"users">;
    if (existingUser) {
      userId = existingUser._id;
      if (fullName && fullName.length > 0 && fullName !== existingUser.name) {
        await ctx.db.patch(existingUser._id, { name: fullName });
      }
    } else {
      userId = await ctx.db.insert("users", {
        email,
        name: fullName && fullName.length > 0 ? fullName : undefined,
      });
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      const updates: {
        role: Role;
        active: boolean;
        updated_at: number;
        full_name?: string;
        church_id?: Id<"churches"> | undefined;
        fund_id?: Id<"funds"> | undefined;
        user_id?: Id<"users">;
      } = {
        role: args.role,
        active: args.active,
        updated_at: updatedAt,
      };

      if (fullName !== undefined) {
        updates.full_name = fullName;
      }
      if (args.user_id) {
        updates.user_id = args.user_id;
      } else if (existing.user_id !== userId) {
        updates.user_id = userId;
      }
      if (args.church_supabase_id !== undefined) {
        updates.church_id = churchId;
      }
      if (args.fund_supabase_id !== undefined) {
        updates.fund_id = fundId;
      }

      await ctx.db.patch(existing._id, {
        ...updates,
      });

      return {
        created: false as const,
        profileId: existing._id,
        role: args.role,
        active: args.active,
      };
    }

    const profileId = await ctx.db.insert("profiles", {
      user_id: args.user_id ?? userId,
      email,
      role: args.role,
      active: args.active,
      full_name: fullName ?? "",
      created_at: createdAt,
      updated_at: updatedAt,
      ...(churchId !== undefined ? { church_id: churchId } : {}),
      ...(fundId !== undefined ? { fund_id: fundId } : {}),
    });

    return {
      created: true as const,
      profileId,
      role: args.role,
      active: args.active,
    };
  },
});

export const deactivateProfileForTest = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!existing) {
      return { deactivated: false, email };
    }

    await ctx.db.patch(existing._id, {
      active: false,
      updated_at: Date.now(),
    });

    return {
      deactivated: true,
      email,
      profileId: existing._id,
    };
  },
});

function isLegacyEmail(token: string): boolean {
  return token.includes("@");
}

async function resolveUserIdByEmail(
  ctx: MutationCtx,
  email: string,
  cache: Map<string, Id<"users"> | null>
): Promise<Id<"users"> | null> {
  const normalized = email.trim().toLowerCase();
  if (cache.has(normalized)) {
    return cache.get(normalized) ?? null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .first();

  const result = user ? user._id : null;
  cache.set(normalized, result);
  return result;
}

type BackfillResult = {
  table: string;
  updated: number;
  skipped: number;
  unresolved: Array<{ id: string; actor: string }>;
};

export const backfillCreatedBy = internalMutation({
  args: {
    dry_run: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userCache = new Map<string, Id<"users"> | null>();

    const tables: Array<{
      name: string;
      collection: "funds" | "providers" | "transactions" | "fund_events" | "reports";
      field: "created_by" | "transactions_created_by";
      systemValues?: Set<string>;
    }> = [
      { name: "funds", collection: "funds", field: "created_by" },
      { name: "providers", collection: "providers", field: "created_by" },
      { name: "transactions", collection: "transactions", field: "created_by" },
      { name: "fund_events", collection: "fund_events", field: "created_by" },
      {
        name: "reports",
        collection: "reports",
        field: "transactions_created_by",
        systemValues: new Set(["system", "legacy-system"]),
      },
    ];

    const results: BackfillResult[] = [];

    for (const table of tables) {
      const docs = await ctx.db.query(table.collection).collect();
      let updated = 0;
      let skipped = 0;
      const unresolved: Array<{ id: string; actor: string }> = [];

      for (const doc of docs) {
        const actor = (doc as Record<string, unknown>)[table.field];
        if (typeof actor !== "string" || actor.length === 0) {
          skipped += 1;
          continue;
        }

        if (table.systemValues?.has(actor) || actor === "system") {
          skipped += 1;
          continue;
        }

        if (isLegacyEmail(actor)) {
          const userId = await resolveUserIdByEmail(ctx, actor, userCache);
          if (userId) {
            const docId = doc._id;
            if (!args.dry_run) {
              await ctx.db.patch(docId, {
                [table.field]: userId,
              });
            }
            updated += 1;
          } else {
            const docId = doc._id;
            unresolved.push({ id: String(docId), actor });
          }
        } else {
          skipped += 1;
        }
      }

      results.push({ table: table.name, updated, skipped, unresolved });
    }

    return {
      tables: results,
    };
  },
});
